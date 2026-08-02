import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { createDeadmanHarness } from "./create_deadman_harness.test_fixture.ts"
import { deriveDeadmanDeadline } from "./derive_deadman_deadline.ts"
import { orchestrateDeadmanReconciliation } from "./orchestrate_deadman_reconciliation.ts"

test("normal synthetic loss launches at 35s, cleans exactly, and releases last", async () => {
  const harness = await createDeadmanHarness()
  try {
    const deadline = deriveDeadmanDeadline(harness.input.handoff)
    const result = await orchestrateDeadmanReconciliation(
      harness.input, harness.dependencies,
    )
    assert.equal(result.status, "inactive_dry_run_verified")
    if (result.status === "manual_reconciliation_required") return
    assert.equal(result.guardResolution, "cleaned")
    assert.deepEqual(harness.telemetry.waitTargets, [deadline])
    assert.deepEqual(harness.telemetry.providerKinds, [
      "deadman_reconciliation", "cleanup", "fast_sample", "resource_sample",
    ])
    assert.equal(harness.telemetry.providerKinds.includes("guard_heartbeat_fast"), false)
    assert.equal(harness.telemetry.providerKinds.includes("rollback"), false)
    assert.equal(result.lockReleased, true)
    assert.equal(harness.sourceReleases(), 1)
    const events = (await readFile(result.receipt.path, "utf8")).trim().split("\n")
      .map((line) => JSON.parse(line).event_type as string)
    assert.deepEqual(events.slice(-6), [
      "stop_requested", "deadman_reconciled", "cleanup_completed",
      "fast_sample", "resource_sample", "run_completed",
    ])
  } finally {
    await harness.cleanup()
  }
})

test("committed, absent, and known-failure handoffs end in their exact typed state", async () => {
  for (const [options, status, resolution] of [
    [{ handoffKind: "ambiguous", guardPresent: true },
      "bootstrap_ambiguity_reconciled", "cleaned"],
    [{ handoffKind: "ambiguous", guardPresent: false },
      "bootstrap_ambiguity_reconciled", "proved_absent"],
    [{ handoffKind: "known_failure" },
      "failure_recovered_by_deadman", "cleaned"],
  ] as const) {
    const harness = await createDeadmanHarness(options)
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, status)
      if (result.status === "manual_reconciliation_required") continue
      assert.equal(result.guardResolution, resolution)
      assert.equal(harness.telemetry.providerKinds.includes("cleanup"),
        resolution === "cleaned")
      assert.equal(harness.sourceReleases(), 1)
    } finally {
      await harness.cleanup()
    }
  }
})

test("an AbortSignal during loss never heartbeats and still reconciles at 35s", async () => {
  const harness = await createDeadmanHarness({ cancelBeforeDeadline: true })
  try {
    const result = await orchestrateDeadmanReconciliation(
      harness.input, harness.dependencies,
    )
    assert.equal(result.status, "inactive_dry_run_verified")
    assert.deepEqual(harness.telemetry.providerKinds.slice(0, 2),
      ["deadman_reconciliation", "cleanup"])
    assert.equal(harness.telemetry.providerKinds.some((kind) =>
      kind.startsWith("guard_heartbeat")), false)
  } finally {
    await harness.cleanup()
  }
})
