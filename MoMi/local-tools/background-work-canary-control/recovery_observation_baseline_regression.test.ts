import assert from "node:assert/strict"
import { readFile, rm } from "node:fs/promises"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { buildCombinedHeartbeatInput } from "./build_combined_heartbeat_input.ts"
import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { DEV_PROJECT_REF } from "./constants.ts"
import { DEADMAN_ADVISORY_LOCK_KEY, DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateRecoveryObservationSql } from "./generate_recovery_observation_sql.ts"
import { VALID_GUARD_BOOTSTRAP_RESULT } from "./guard_bootstrap.test_fixture.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { RECOVERY_OBSERVATION_MARKER } from "./recovery_constants.ts"
import { encodeRecoveryResult, VALID_RECOVERY_CONTROL_INPUT,
  VALID_ROLLBACK_INACTIVE_RESULT } from "./recovery_control.test_fixture.ts"
import { ROLLBACK_MARKER } from "./recovery_control_constants.ts"
import { runRecoveryObservation } from "./run_recovery_observation.ts"
import { runRecoveryRollback } from "./run_recovery_rollback.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE, EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

const bootstrapRunId = 1_000
const activationRunId = 1_003

test("a changed activation baseline rejects the original guard command", () => {
  const runtime = { options: { projectRef: DEV_PROJECT_REF } } as never
  const input = buildCombinedHeartbeatInput(runtime,
    VALID_GUARD_BOOTSTRAP_RESULT.runId, 12, "a".repeat(64), "b".repeat(64),
    activationRunId, false)
  const { includeResource: _resource, ...heartbeat } = input
  const activation = { startedAtUtcMs: 1_785_752_000_000,
    frozen: createRecoverySnapshotFixture({ maxCronRunId: activationRunId }),
    targetJobs: createRecoverySnapshotFixture().targetJobs, guardJobId: 12,
    generationSha256: "a".repeat(64), guardCommandSha256: "c".repeat(64) }
  const sql = generateRecoveryObservationSql(heartbeat, activation, false)
  const command = (startCronRunId: number) => generateDeadmanCommand({
    runId: input.runId, generationSha256: input.currentGenerationSha256,
    startCronRunId, guardName: EXPECTED_GUARD_NAME,
    guardSchedule: EXPECTED_GUARD_SCHEDULE, targetJobs: EXPECTED_TARGET_JOBS,
    advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  }).replace(DEADMAN_EXPIRY_PLACEHOLDER, "2026-08-03T12:30:00.000000Z")
  assert.notEqual(command(bootstrapRunId), command(activationRunId))
  assert.match(sql, /current_command <> replace\(current_template/)
  assert.match(sql, /start_cron_run_id constant bigint := 1003/)
})

test("repeated observations retain guard baseline, owner, lock, receipts, and rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-330-baseline-"))
  const queries: string[] = []
  const controller = new AbortController()
  const lock = { status: () => "held" as const, lossSignal: controller.signal }
  const provider = createFakeHeldProvider({ runQuery: async ({ sqlPath }) => {
    const sql = await readFile(sqlPath, "utf8")
    queries.push(sql)
    let stdout: Uint8Array
    if (sql.includes(RECOVERY_OBSERVATION_MARKER)) {
      const previous = sql.match(/'previousGenerationSha256',\s*'([a-f0-9]{64})'/)![1]
      const next = sql.match(/'nextGenerationSha256', '([a-f0-9]{64})'/)![1]
      stdout = encodeQueryEnvelope(RECOVERY_OBSERVATION_MARKER, {
        previousGenerationSha256: previous, nextGenerationSha256: next,
        guardJobId: 12, observation: createRecoverySnapshotFixture({
          maxCronRunId: activationRunId + queries.length, guardIdentityCount: 1,
        }),
      })
    } else stdout = encodeRecoveryResult(ROLLBACK_MARKER,
      VALID_ROLLBACK_INACTIVE_RESULT)
    return { outcome: { status: "success", exitCode: 0, signal: null,
      stdoutBytes: stdout.byteLength, stderrBytes: 0, limitedStream: null },
    stdout, stderr: new Uint8Array() }
  } })
  try {
    const receipt = await initializeReceipt(root, VALID_GUARD_BOOTSTRAP_RESULT.runId)
    const frozen = createRecoverySnapshotFixture({ maxCronRunId: activationRunId })
    const runtime = { options: { environment: "dev", projectRef: DEV_PROJECT_REF },
      repository: VALID_RECOVERY_CONTROL_INPUT.repository, provider, lock } as never
    const state = { runtime, repositoryRoot: process.cwd(), receiptRoot: root,
      signal: controller.signal, receipt, runId: VALID_GUARD_BOOTSTRAP_RESULT.runId,
      generationSha256: VALID_GUARD_BOOTSTRAP_RESULT.generationSha256,
      guard: VALID_GUARD_BOOTSTRAP_RESULT, guardStartCronRunId: bootstrapRunId,
      activation: { startedAtUtcMs: frozen.observedAtUtcMs, frozen,
        targetJobs: frozen.targetJobs, guardJobId: 12,
        generationSha256: VALID_GUARD_BOOTSTRAP_RESULT.generationSha256,
        guardCommandSha256: VALID_GUARD_BOOTSTRAP_RESULT.commandSha256 },
    } as never
    for (const [index, resource] of [false, true].entries()) {
      await runRecoveryObservation(state, `${index + 13}`.repeat(64).slice(0, 64), resource)
      await appendReceipt(receipt, { event_type: "canary_observation",
        timestamp_utc: `2026-08-03T12:00:${index === 0 ? "15" : "30"}.000Z`,
        metrics: { status: "passed", sample_kind: resource ?
          "fast_and_resource" : "fast", generation_sha256: state.generationSha256 } })
      assert.equal(provider.status(), "held")
      assert.equal(lock.status(), "held")
    }
    await runRecoveryRollback(state)
    assert.equal((await verifyReceiptFile(receipt.path)).count, 2)
    assert.equal(queries.length, 3)
    for (const sql of queries.slice(0, 2)) {
      assert.match(sql, /start_cron_run_id constant bigint := 1000/)
      assert.match(sql, /where runid > 1003/)
    }
    assert.doesNotMatch(queries[0], /pg_ls_waldir/)
    assert.match(queries[1], /pg_ls_waldir/)
    assert.ok(queries[2].indexOf("job_id := 3") < queries[2].indexOf("job_id := 2"))
    assert.ok(queries[2].indexOf("job_id := 2") < queries[2].indexOf("job_id := 11"))
    assert.equal(provider.status(), "held")
    assert.equal(lock.status(), "held")
  } finally { await rm(root, { recursive: true, force: true }) }
})
