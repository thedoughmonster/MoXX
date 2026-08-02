import assert from "node:assert/strict"
import { test } from "node:test"

import { createDeadmanHarness } from "./create_deadman_harness.test_fixture.ts"
import { orchestrateDeadmanReconciliation } from "./orchestrate_deadman_reconciliation.ts"

test("holder death in every post-guard lifecycle class completes dead-man recovery", async () => {
  for (const holderLossAt of ["wait", "reconciliation", "cleanup", "final"] as const) {
    const harness = await createDeadmanHarness({ holderLossAt })
    try {
      const result = await orchestrateDeadmanReconciliation(
        harness.input, harness.dependencies,
      )
      assert.equal(result.status, "failure_recovered_by_deadman", holderLossAt)
      if (result.status !== "failure_recovered_by_deadman") continue
      assert.equal(result.terminalEvidence?.guardStatus, "succeeded")
      assert.equal(result.finalFast.targetJobs.every((job) => !job.active), true)
    } finally {
      await harness.cleanup()
    }
  }
})
