import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { createSamplingHarness } from "./create_sampling_harness.test_fixture.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"

test("threshold stop writes its boundary receipt then runs one fresh rollback", async () => {
  const harness = await createSamplingHarness({ thresholdAt: 2 })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "sampling_failed_rollback_completed")
    if (result.status !== "sampling_failed_rollback_completed") return
    assert.equal(result.reason, "threshold_stop")
    assert.deepEqual(result.stopReasons, ["toast_ready_decreased"])
    assert.equal(result.rollback.guardState, "guard_inactive")
    assert.equal(result.receiptVerified, true)
    assert.equal(result.lockReleased, true)
    assert.equal(harness.telemetry.combinedCalls, 3)
    assert.equal(harness.telemetry.providerKinds.filter((kind) => kind === "rollback").length, 1)
    assert.equal(harness.telemetry.releases, 1)
  } finally {
    await harness.cleanup()
  }
})

test("a provider failure before bootstrap remains pre-guard and releases the lock", async () => {
  const harness = await createSamplingHarness({
    providerFailure: { kind: "resource_sample", reason: "exit_failure" },
  })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.deepEqual(result, {
      status: "pre_guard_failure", stage: "preflight_resource", reason: "exit_failure",
      runId: `run-${"01".repeat(12)}`, receiptVerified: true, lockReleased: true,
    })
    assert.deepEqual(harness.telemetry.providerKinds, ["resource_sample"])
    assert.equal(harness.telemetry.releases, 1)
  } finally {
    await harness.cleanup()
  }
})

test("post-commit receipt failure rolls back without advancing or cleanup", async () => {
  const harness = await createSamplingHarness({ receiptFailureAt: 4 })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "sampling_failed_rollback_completed")
    if (result.status !== "sampling_failed_rollback_completed") return
    assert.equal(result.stage, "receipt")
    assert.equal(result.reason, "receipt_failure")
    assert.equal(result.receiptVerified, false)
    assert.equal(harness.telemetry.combinedCalls, 0)
    assert.equal(harness.telemetry.providerKinds.at(-1), "rollback")
    assert.equal(harness.telemetry.providerKinds.includes("cleanup"), false)
    assert.equal(harness.telemetry.releases, 1)
  } finally {
    await harness.cleanup()
  }
})

test("rollback unavailability preserves the provider dead-man and lifecycle lock", async () => {
  const harness = await createSamplingHarness({
    thresholdAt: 0,
    providerFailure: { kind: "rollback", reason: "timed_out" },
  })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "sampling_failed_deadman_fallback_pending")
    if (result.status !== "sampling_failed_deadman_fallback_pending") return
    assert.equal(result.stage, "rollback")
    assert.equal(result.reason, "timed_out")
    assert.equal(result.samplesCompleted, 1)
    assert.equal(result.lockReleased, false)
    assert.equal(harness.telemetry.releases, 0)
    const receipt = await readFile(result.receipt.path, "utf8")
    assert.match(receipt, /provider_deadman_fallback_pending/)
    assert.doesNotMatch(receipt, /cleanup_completed/)
  } finally {
    await harness.cleanup()
  }
})

test("cancellation after guard verification stops before a heartbeat and rolls back", async () => {
  const harness = await createSamplingHarness({ cancelAt: 0 })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "sampling_failed_rollback_completed")
    if (result.status !== "sampling_failed_rollback_completed") return
    assert.equal(result.reason, "cancelled")
    assert.equal(harness.telemetry.combinedCalls, 0)
    assert.equal(harness.telemetry.providerKinds.at(-1), "rollback")
    assert.equal(result.lockReleased, true)
  } finally {
    await harness.cleanup()
  }
})

test("provider exits persist only bounded diagnostics", async () => {
  const harness = await createSamplingHarness({ providerFailure: {
    kind: "guard_heartbeat_resource", combinedIndex: 0,
    reason: "exit_failure", childExitCode: 1,
    providerCode: "momi_guard_heartbeat_current_command",
  } })
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "sampling_failed_rollback_completed")
    if (result.status !== "sampling_failed_rollback_completed") return
    assert.equal(result.reason, "exit_failure")
    const receipt = await readFile(result.receipt.path, "utf8")
    assert.match(receipt, /"child_exit_code":1/)
    assert.match(receipt, /"provider_code":"momi_guard_heartbeat_current_command"/)
    assert.doesNotMatch(receipt, /raw_sql|stderr|secret/)
  } finally {
    await harness.cleanup()
  }
})
