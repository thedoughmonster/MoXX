import assert from "node:assert/strict"
import { test } from "node:test"
import { buildDeadmanReconciliationOutput } from "./build_deadman_reconciliation_output.test_fixture.ts"
import { createDeadmanHarness } from "./create_deadman_harness.test_fixture.ts"
import { deriveDeadmanDeadline } from "./derive_deadman_deadline.ts"
import { parseDeadmanReconciliationOutput } from "./parse_deadman_reconciliation_output.ts"

test("parser accepts exact known and ambiguous-absent dead-man evidence", async () => {
  for (const [handoffKind, guardPresent, expected] of [
    ["normal", true, "deadman_reconciled"],
    ["ambiguous", false, "bootstrap_not_committed_or_rolled_back"],
  ] as const) {
    const harness = await createDeadmanHarness({ handoffKind })
    try {
      const handoff = harness.input.handoff
      const ambiguous = handoff.status === "bootstrap_ambiguous_deadman_fallback_pending"
      const result = parseDeadmanReconciliationOutput(
        buildDeadmanReconciliationOutput(
          handoff, deriveDeadmanDeadline(handoff), guardPresent,
        ),
        {
          mode: ambiguous ? "ambiguous" : "known", runId: handoff.runId,
          generationSha256: ambiguous
            ? handoff.attemptedGenerationSha256 : handoff.currentGenerationSha256,
          guardJobId: ambiguous ? null : handoff.guard.guardJobId,
          startCronRunId: handoff.resourceBaseline.maxCronRunId,
          workBaseline: handoff.workBaseline,
        },
      )
      assert.equal(result.status, expected)
      assert.equal(result.guardJobId, guardPresent ? 12 : null)
    } finally {
      await harness.cleanup()
    }
  }
})

test("parser rejects every structural, history, command, target, and activity drift", async () => {
  const harness = await createDeadmanHarness()
  try {
    const handoff = harness.input.handoff
    if (handoff.status !== "sampling_complete_waiting_for_synthetic_loss") return
    const context = {
      mode: "known", runId: handoff.runId,
      generationSha256: handoff.currentGenerationSha256,
      guardJobId: handoff.guard.guardJobId,
      startCronRunId: handoff.resourceBaseline.maxCronRunId,
      workBaseline: handoff.workBaseline,
    }
    for (const fault of [
      "active_guard", "active_target", "duplicate_guard", "failed_history",
      "identity_drift", "late_history", "target_drift", "active_before",
      "reassigned_id", "terminal_command_drift",
    ] as const) assert.throws(() => parseDeadmanReconciliationOutput(
      buildDeadmanReconciliationOutput(
        handoff, deriveDeadmanDeadline(handoff), true, fault,
      ), context,
    ))
  } finally {
    await harness.cleanup()
  }
})
