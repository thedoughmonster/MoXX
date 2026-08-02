import assert from "node:assert/strict"
import { test } from "node:test"
import { createSamplingHarness } from "./create_sampling_harness.test_fixture.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"

test("every ambiguous bootstrap outcome preserves proof, dead-man, and lock", async () => {
  const faults = [
    "timed_out", "cancelled", "signalled", "exit_failure", "output_limit",
    "adapter_failure",
  ] as const
  for (const reason of faults) {
    const harness = await createSamplingHarness({
      providerFailure: { kind: "guard_bootstrap", reason },
    })
    try {
      const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
      assert.equal(result.status, "bootstrap_ambiguous_deadman_fallback_pending")
      if (result.status !== "bootstrap_ambiguous_deadman_fallback_pending") continue
      assert.equal(result.reason, reason)
      assert.equal(result.attemptedGenerationSha256, "02".repeat(32))
      assert.equal(result.guardName, "momi-issue-330-canary-deadman-v1")
      assert.equal(result.workBaseline.toastReady, 1)
      assert.equal(result.resourceBaseline.maxCronRunId, 1_000)
      assert.equal(result.lockReleased, false)
      assert.equal(harness.telemetry.providerKinds.includes("rollback"), false)
      assert.equal(harness.telemetry.combinedCalls, 0)
      assert.equal(harness.telemetry.releases, 0)
    } finally {
      await harness.cleanup()
    }
  }
  const drift = await createSamplingHarness({ bootstrapSchemaDrift: true })
  try {
    const result = await orchestrateGuardedSampling(drift.input, drift.dependencies)
    assert.equal(result.status, "bootstrap_ambiguous_deadman_fallback_pending")
    if (result.status === "bootstrap_ambiguous_deadman_fallback_pending") {
      assert.equal(result.reason, "schema_failure")
      assert.equal(result.receipt.poisoned, false)
    }
    assert.equal(drift.telemetry.providerKinds.includes("rollback"), false)
    assert.equal(drift.telemetry.releases, 0)
  } finally {
    await drift.cleanup()
  }
})
