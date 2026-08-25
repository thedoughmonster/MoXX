import assert from "node:assert/strict"
import { test } from "node:test"
import { createDeadmanHarness } from "./create_deadman_harness.test_fixture.ts"
import { orchestrateDeadmanReconciliation } from "./orchestrate_deadman_reconciliation.ts"

test("cleanup provider or active-target refusal stops before final readback", async () => {
  for (const options of [
    { providerFailure: { kind: "cleanup" as const, reason: "exit_failure" as const } },
    { cleanupActiveRefusal: true },
  ]) {
    const harness = await createDeadmanHarness(options)
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "manual_reconciliation_required")
      if (result.status !== "manual_reconciliation_required") continue
      assert.equal(result.reason, "cleanup_failed")
      assert.deepEqual(harness.telemetry.providerKinds,
        ["deadman_reconciliation", "cleanup"])
      assert.equal(result.evidence.cleanupAttempted, true)
      assert.equal(harness.sourceReleases(), 0)
    } finally {
      await harness.cleanup()
    }
  }
})

test("final ready and resource gates refuse terminal success after cleanup", async () => {
  for (const options of [
    { finalReadyDecrease: true }, { finalResourceGrowth: true },
  ]) {
    const harness = await createDeadmanHarness(options)
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "manual_reconciliation_required")
      if (result.status !== "manual_reconciliation_required") continue
      assert.ok(["final_threshold_failed", "final_resource_failed"].includes(result.reason))
      assert.equal(harness.telemetry.providerKinds.includes("cleanup"), true)
      assert.equal(result.lockReleased, false)
      assert.equal(harness.sourceReleases(), 0)
    } finally {
      await harness.cleanup()
    }
  }
})

test("receipt poison or verification loss always keeps the lifecycle lock", async () => {
  for (const options of [
    { receiptFailureAt: 1 }, { receiptFailureAt: 6 }, { verifyFailure: true },
  ]) {
    const harness = await createDeadmanHarness(options)
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "manual_reconciliation_required")
      if (result.status !== "manual_reconciliation_required") continue
      assert.ok(["receipt_failure", "receipt_verification_failed"].includes(result.reason))
      assert.equal(result.lockReleased, false)
      assert.equal(result.evidence.receiptVerified, false)
      assert.equal(harness.sourceReleases(), 0)
    } finally {
      await harness.cleanup()
    }
  }
})
