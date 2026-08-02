import assert from "node:assert/strict"
import { test } from "node:test"

import { createSamplingHarness } from "./create_sampling_harness.test_fixture.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"
import type { SamplingHarnessOptions } from "./sampling_test_types.test_fixture.ts"

test("holder death before a known guard is a typed pre-guard failure", async () => {
  for (const lockLossAt of [
    "identity", "run_started_receipt", "preflight_resource", "preflight_fast",
  ] as const) {
    const harness = await createSamplingHarness({ lockLossAt })
    try {
      const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
      assert.equal(result.status, "pre_guard_failure", lockLossAt)
      if (result.status !== "pre_guard_failure") continue
      assert.equal(result.reason, "lifecycle_lock_lost")
    } finally {
      await harness.cleanup()
    }
  }
})

test("holder death after guard commitment always enters rollback recovery", async () => {
  const cases: SamplingHarnessOptions["lockLossAt"][] = [
    "bootstrap_receipt", "sampling_provider", "sampling_receipt",
    "receipt_verification",
  ]
  for (const lockLossAt of cases) {
    const harness = await createSamplingHarness({ lockLossAt })
    try {
      const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
      assert.equal(result.status, "sampling_failed_rollback_completed", lockLossAt)
      if (result.status !== "sampling_failed_rollback_completed") continue
      assert.equal(result.reason, "lifecycle_lock_lost")
      assert.equal(result.rollback.guardPresent, true)
    } finally {
      await harness.cleanup()
    }
  }
})

test("holder death during guard creation preserves the named dead-man fallback", async () => {
  const harness = await createSamplingHarness({ lockLossAt: "bootstrap" })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "bootstrap_ambiguous_deadman_fallback_pending")
    if (result.status === "bootstrap_ambiguous_deadman_fallback_pending") {
      assert.equal(result.reason, "lifecycle_lock_lost")
    }
  } finally {
    await harness.cleanup()
  }
})

test("a replacement process remains fenced by the existing named guard", async () => {
  const harness = await createSamplingHarness({ preexistingGuard: true })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "pre_guard_failure")
    assert.deepEqual(harness.telemetry.providerKinds, ["resource_sample"])
  } finally {
    await harness.cleanup()
  }
})
