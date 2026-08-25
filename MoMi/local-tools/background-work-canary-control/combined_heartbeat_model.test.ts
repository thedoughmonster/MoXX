import assert from "node:assert/strict"
import { test } from "node:test"
import { modelCombinedHeartbeat } from "./model_combined_heartbeat.ts"

const base = {
  sqlCommitted: true,
  parseSucceeded: true,
  coverageValid: true,
  resourceExpected: false,
  resourceMatched: true,
  thresholdStopCount: 0,
}

test("model preserves exact fast and resource success stage ordering", () => {
  assert.deepEqual(modelCombinedHeartbeat(base), {
    outcome: "heartbeat_committed_fast_passed",
    actions: [
      "execute_combined_transaction", "heartbeat_committed", "parse_heartbeat",
      "parse_fast", "evaluate_thresholds", "sample_passed",
    ],
  })
  assert.deepEqual(modelCombinedHeartbeat({ ...base, resourceExpected: true }), {
    outcome: "heartbeat_committed_resource_passed",
    actions: [
      "execute_combined_transaction", "heartbeat_committed", "parse_heartbeat",
      "parse_fast", "parse_resource", "evaluate_thresholds", "sample_passed",
    ],
  })
})

test("SQL rollback is distinct from all committed sample failures", () => {
  assert.deepEqual(modelCombinedHeartbeat({ ...base, sqlCommitted: false }), {
    outcome: "sql_rollback",
    actions: ["execute_combined_transaction", "rollback"],
  })
  const cases = [
    [{ parseSucceeded: false }, "heartbeat_committed_parse_failure"],
    [{ coverageValid: false }, "heartbeat_committed_coverage_rollover"],
    [{ resourceMatched: false }, "heartbeat_committed_resource_mismatch"],
    [{ thresholdStopCount: 1 }, "heartbeat_committed_stop_required"],
  ] as const
  for (const [change, outcome] of cases) {
    const result = modelCombinedHeartbeat({ ...base, ...change })
    assert.equal(result.outcome, outcome)
    assert.equal(result.actions.at(-1), "rollback_required")
    assert.ok(result.actions.includes("heartbeat_committed"))
  }
})
