import assert from "node:assert/strict"
import test from "node:test"

import { buildDeadmanReconciliationOutput } from "./build_deadman_reconciliation_output.test_fixture.ts"
import { createDeadmanHarness } from "./create_deadman_harness.test_fixture.ts"
import { deriveDeadmanDeadline } from "./derive_deadman_deadline.ts"
import { parseDeadmanReconciliationOutput } from "./parse_deadman_reconciliation_output.ts"
import { runRecoveryDeadman } from "./run_recovery_deadman.ts"

test("dead-man reconciliation accepts the exact recovery active-before mask", async () => {
  const harness = await createDeadmanHarness()
  try {
    const handoff = harness.input.handoff
    if (handoff.status !== "sampling_complete_waiting_for_synthetic_loss") return
    const result = parseDeadmanReconciliationOutput(
      buildDeadmanReconciliationOutput(handoff, deriveDeadmanDeadline(handoff),
        true, "recovery_active_before"),
      { mode: "known", runId: handoff.runId,
        generationSha256: handoff.currentGenerationSha256,
        guardJobId: handoff.guard.guardJobId,
        startCronRunId: handoff.resourceBaseline.maxCronRunId,
        workBaseline: handoff.workBaseline }, 11)
    assert.equal(result.status, "deadman_reconciled")
    assert.equal(result.terminalEvidence?.activeBeforeMask, 11)
  } finally { await harness.cleanup() }
})

test("OS lock loss still permits dead-man reconciliation; provider loss fails closed", async () => {
  const baseline = { maxCronRunId: 1 }
  const base = { guard: { guardJobId: 20 }, preflight: baseline,
    runId: "run-0123456789abcdef01234567", generationSha256: "a".repeat(64),
    repositoryRoot: "/tmp/recovery-test",
    runtime: { lock: { status: () => "lost" }, provider: { status: () => "held" } } }
  let waited = 0
  const reconciled = await runRecoveryDeadman(base as never, {
    wait: async () => { waited += 1; return true },
    query: async () => ({ status: "success", value: {
      status: "deadman_reconciled", terminalEvidence: {
        generationSha256: "a".repeat(64),
      },
    } }) as never,
  })
  assert.equal(reconciled, true)
  assert.equal(waited, 1)
  assert.equal((base as { deadmanReconciled?: boolean }).deadmanReconciled, true)
  const providerLost = { ...base, runtime: { lock: { status: () => "held" },
    provider: { status: () => "lost" } } }
  waited = 0
  assert.equal(await runRecoveryDeadman(providerLost as never, {
    wait: async () => { waited += 1; return true },
    query: async () => { throw new Error("must not query") },
  }), false)
  assert.equal(waited, 0)
})
