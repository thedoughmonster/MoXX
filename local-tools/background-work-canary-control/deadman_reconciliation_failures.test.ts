import assert from "node:assert/strict"
import { test } from "node:test"
import { createDeadmanHarness } from "./create_deadman_harness.test_fixture.ts"
import type { DeadmanReconciliationFault } from "./deadman_test_types.test_fixture.ts"
import { orchestrateDeadmanReconciliation } from "./orchestrate_deadman_reconciliation.ts"

test("duplicate, identity, target, active, failed, and late evidence never cleans", async () => {
  const faults: DeadmanReconciliationFault[] = [
    "active_guard", "active_target", "duplicate_guard", "failed_history",
    "identity_drift", "late_history", "target_drift", "active_before",
    "reassigned_id", "terminal_command_drift",
  ]
  for (const reconciliationFault of faults) {
    const harness = await createDeadmanHarness({ reconciliationFault })
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "manual_reconciliation_required")
      if (result.status !== "manual_reconciliation_required") continue
      assert.equal(result.reason, "reconciliation_failed")
      assert.deepEqual(harness.telemetry.providerKinds, ["deadman_reconciliation"])
      assert.equal(result.evidence.cleanupAttempted, false)
      assert.equal(result.lockReleased, false)
      assert.equal(harness.sourceReleases(), 0)
    } finally {
      await harness.cleanup()
    }
  }
})

test("known absence and ambiguous attempted history remain manual", async () => {
  for (const options of [
    { guardPresent: false },
    { handoffKind: "ambiguous" as const, guardPresent: false,
      reconciliationFault: "ambiguous_history" as const },
  ]) {
    const harness = await createDeadmanHarness(options)
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "manual_reconciliation_required")
      assert.deepEqual(harness.telemetry.providerKinds, ["deadman_reconciliation"])
      assert.equal(harness.sourceReleases(), 0)
    } finally {
      await harness.cleanup()
    }
  }
})

test("unavailable or late reconciliation is terminal without cleanup", async () => {
  for (const options of [
    { providerFailure: { kind: "deadman_reconciliation" as const,
      reason: "timed_out" as const } },
    { launchDelayMs: 251 },
  ]) {
    const harness = await createDeadmanHarness(options)
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "manual_reconciliation_required")
      if (result.status !== "manual_reconciliation_required") continue
      assert.ok(["deadline_late_or_missed", "reconciliation_failed"].includes(result.reason))
      assert.equal(harness.telemetry.providerKinds.includes("cleanup"), false)
      assert.equal(result.evidence.receiptVerified, true)
      assert.equal(harness.sourceReleases(), 0)
    } finally {
      await harness.cleanup()
    }
  }
})
