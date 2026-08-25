import assert from "node:assert/strict"
import { test } from "node:test"
import {
  encodeCombinedResult,
  VALID_COMBINED_CONTEXT,
  VALID_COMBINED_FAST_RAW,
  VALID_COMBINED_RESOURCE_RAW,
  VALID_COMBINED_RESULT,
  VALID_RESOURCE_BASELINE,
} from "./combined_heartbeat.test_fixture.ts"
import { parseCombinedHeartbeatOutput } from "./parse_combined_heartbeat_output.ts"
import {
  FAST_QUERY_SAMPLE_KEYS,
  RESOURCE_QUERY_SAMPLE_KEYS,
} from "./query_payload_constants.ts"

test("44-ready preserved backlog passes the complete fast envelope", () => {
  assert.deepEqual(Object.keys(VALID_COMBINED_FAST_RAW).sort(),
    [...FAST_QUERY_SAMPLE_KEYS].sort())
  const parsed = parseCombinedHeartbeatOutput(
    encodeCombinedResult(VALID_COMBINED_RESULT), VALID_COMBINED_CONTEXT,
  )
  assert.equal(parsed.status, "heartbeat_committed_passed")
  assert.equal(parsed.fast.toastReady, 44)
  assert.deepEqual(parsed.stopReasons, [])
  assert.equal(parsed.resource, null)
})

test("resource variant shares the exact clock and parses all resource fields", () => {
  assert.deepEqual(Object.keys(VALID_COMBINED_RESOURCE_RAW).sort(),
    [...RESOURCE_QUERY_SAMPLE_KEYS].sort())
  const sample = {
    ...VALID_COMBINED_RESULT,
    resourceIncluded: true,
    resource: VALID_COMBINED_RESOURCE_RAW,
  }
  const context = {
    ...VALID_COMBINED_CONTEXT,
    includeResource: true,
    resourceBaseline: VALID_RESOURCE_BASELINE,
  }
  const parsed = parseCombinedHeartbeatOutput(encodeCombinedResult(sample), context)
  assert.equal(parsed.status, "heartbeat_committed_passed")
  assert.equal(parsed.resource?.observedAtUtcMs, parsed.fast.observedAtUtcMs)
  assert.equal(parsed.heartbeat.observedAtUtcMs, parsed.fast.observedAtUtcMs)
})

test("unsafe work commits the heartbeat but requires immediate rollback", () => {
  const sample = {
    ...VALID_COMBINED_RESULT,
    fast: { ...VALID_COMBINED_FAST_RAW, toastRunning: 1 },
  }
  const parsed = parseCombinedHeartbeatOutput(
    encodeCombinedResult(sample), VALID_COMBINED_CONTEXT,
  )
  assert.equal(parsed.status, "heartbeat_committed_stop_required")
  assert.deepEqual(parsed.stopReasons, ["toast_running"])
})

test("coverage, clock, guard, hash, extra-field, and resource drift reject", () => {
  const samples = [
    { ...VALID_COMBINED_RESULT, fast: {
      ...VALID_COMBINED_FAST_RAW, coveredAfterRunId: 1_001 } },
    { ...VALID_COMBINED_RESULT, fast: {
      ...VALID_COMBINED_FAST_RAW, observedAtUtcMs: 1 } },
    { ...VALID_COMBINED_RESULT, fast: {
      ...VALID_COMBINED_FAST_RAW, guardJobId: 13 } },
    { ...VALID_COMBINED_RESULT, heartbeat: {
      ...VALID_COMBINED_RESULT.heartbeat, commandSha256: "0".repeat(64) } },
    { ...VALID_COMBINED_RESULT, extra: true },
    { ...VALID_COMBINED_RESULT, resourceIncluded: true },
  ]
  for (const sample of samples) assert.throws(() => parseCombinedHeartbeatOutput(
    encodeCombinedResult(sample), VALID_COMBINED_CONTEXT,
  ))
})
