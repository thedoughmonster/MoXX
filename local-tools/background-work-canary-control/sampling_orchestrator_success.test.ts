import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { createSamplingHarness } from "./create_sampling_harness.test_fixture.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"

test("orchestrator seals baselines, guard, and exactly 21 receipt-gated boundaries", async () => {
  const harness = await createSamplingHarness()
  try {
    const result = await orchestrateGuardedSampling(harness.input, harness.dependencies)
    assert.equal(result.status, "sampling_complete_waiting_for_synthetic_loss")
    if (result.status !== "sampling_complete_waiting_for_synthetic_loss") return
    assert.equal(result.samplesCompleted, 21)
    assert.equal(result.resourceSamplesCompleted, 6)
    assert.equal(result.startBoundaryUtcMs, Date.UTC(2026, 7, 2, 12, 0, 15))
    assert.equal(result.currentGenerationSha256, "17".repeat(32))
    assert.equal(harness.telemetry.combinedCalls, 21)
    assert.equal(harness.telemetry.randomCalls, 23)
    assert.equal(harness.telemetry.releases, 0)
    assert.deepEqual(harness.telemetry.observedBoundaries,
      Array.from({ length: 21 }, (_, index) =>
        Date.UTC(2026, 7, 2, 12, 0, 15) + index * 15_000))
    assert.deepEqual(harness.telemetry.providerKinds.slice(0, 3), [
      "resource_sample", "fast_sample", "guard_bootstrap",
    ])
    assert.deepEqual(harness.telemetry.providerKinds.slice(3).filter((_, index) =>
      index % 4 === 0), Array(6).fill("guard_heartbeat_resource"))
    assert.equal(harness.telemetry.providerKinds.includes("rollback"), false)
    assert.equal(harness.telemetry.providerKinds.includes("cleanup"), false)
    const records = (await readFile(result.receipt.path, "utf8")).trim().split("\n")
      .map((line) => JSON.parse(line) as { event_type: string })
    assert.equal(records.length, 25)
    assert.equal(records.filter((record) => record.event_type === "resource_sample").length, 7)
    assert.equal(records.some((record) => record.event_type === "run_completed"), false)
    assert.equal(records.some((record) => record.event_type === "cleanup_completed"), false)
  } finally {
    await harness.cleanup()
  }
})
