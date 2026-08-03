import assert from "node:assert/strict"
import test from "node:test"

import { generateRecoveryActivationSql } from "./generate_recovery_activation_sql.ts"
import { generateRecoveryRollbackSql } from "./generate_recovery_rollback_sql.ts"
import { buildRecoveryControlInput } from "./build_recovery_control_input.ts"
import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import { DEV_PROJECT_REF } from "./constants.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE } from "./sample_constants.ts"

test("recovery activation and rollback use the accepted exact orders", () => {
  const guard: GuardBootstrapResult = { guardJobId: 20,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    guardActive: true, runId: "run-0123456789abcdef01234567",
    generationSha256: "a".repeat(64), expiryUtc: "2026-08-03T10:30:00.000000Z",
    commandSha256: "b".repeat(64), commandMd5: "c".repeat(32) }
  const activation = generateRecoveryActivationSql(guard)
  const positions = [11, 2, 3].map((id) => activation.indexOf(
    `cron.alter_job(job_id := ${id}, active := true)`,
  ))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  assert.equal(activation.includes("update cron.job"), false)
  assert.match(activation, /guard_expiry <= clock_timestamp/)
  const runtime = { options: { env: "dev", projectRef: DEV_PROJECT_REF },
    repository: { nodeVersion: "24.14.0", pnpmVersion: "11.7.0",
      supabaseCliVersion: "2.109.1", branch: "dev", headSha: "d".repeat(40),
      projectRef: DEV_PROJECT_REF } } as never
  const rollback = generateRecoveryRollbackSql(buildRecoveryControlInput(runtime, 20),
    guard.runId, guard.generationSha256)
  const rollbackPositions = [3, 2, 11].map((id) => rollback.indexOf(
    `cron.alter_job(job_id := ${id}, active := false)`,
  ))
  assert.deepEqual([...rollbackPositions].sort((a, b) => a - b), rollbackPositions)
  assert.doesNotMatch(rollback, /job_id := 4, active := false/)
  assert.match(rollback, /momi_recovery_rollback_generation/)
  const ambiguous = generateRecoveryRollbackSql(buildRecoveryControlInput(runtime, 20),
    guard.runId, [guard.generationSha256, "e".repeat(64)])
  assert.match(ambiguous, /a{64}.* or .*e{64}/)
})
