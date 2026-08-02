import assert from "node:assert/strict"
import test from "node:test"

import {
  VALID_FAST_SAMPLE,
  VALID_RESOURCE_SAMPLE,
} from "./sample_fixtures.test_fixture.ts"
import { validateFastSample } from "./validate_fast_sample.ts"
import { validateResourceSample } from "./validate_resource_sample.ts"

test("sample validators accept only exact sanitized identities and finite counters", () => {
  assert.deepEqual(validateFastSample(VALID_FAST_SAMPLE), VALID_FAST_SAMPLE)
  assert.deepEqual(validateResourceSample(VALID_RESOURCE_SAMPLE), VALID_RESOURCE_SAMPLE)

  const unknown = { ...VALID_FAST_SAMPLE, rawProviderOutput: "unsafe" }
  assert.throws(() => validateFastSample(unknown), /schema is invalid/)
  const missing = structuredClone(VALID_FAST_SAMPLE) as Record<string, unknown>
  delete missing.waitingLocks
  assert.throws(() => validateFastSample(missing), /schema is invalid/)

  for (const badValue of ["1", Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5]) {
    assert.throws(
      () => validateFastSample({ ...VALID_FAST_SAMPLE, toastReady: badValue }),
      /nonnegative safe integer/,
    )
  }
  assert.throws(
    () => validateFastSample({ ...VALID_FAST_SAMPLE, guard: {
      ...VALID_FAST_SAMPLE.guard, active: "true",
    } }),
    /Guard identity or schedule drifted/,
  )

  const targetDrifts = [
    ["jobId", 99],
    ["jobName", "wrong-name"],
    ["schedule", "9 seconds"],
    ["commandMd5", "00000000000000000000000000000000"],
  ] as const
  for (const [key, value] of targetDrifts) {
    const drift = structuredClone(VALID_FAST_SAMPLE) as any
    drift.targetJobs[0][key] = value
    assert.throws(() => validateFastSample(drift), /drifted/)
  }
  const targetUnknown = structuredClone(VALID_FAST_SAMPLE) as any
  targetUnknown.targetJobs[0].command = "unsafe"
  assert.throws(() => validateFastSample(targetUnknown), /schema is invalid/)
  assert.throws(
    () => validateFastSample({ ...VALID_FAST_SAMPLE, guard: {
      ...VALID_FAST_SAMPLE.guard, schedule: "10 seconds",
    } }),
    /drifted/,
  )

  assert.throws(
    () => validateResourceSample({ ...VALID_RESOURCE_SAMPLE, unknown: 0 }),
    /schema is invalid/,
  )
  const missingResource = structuredClone(VALID_RESOURCE_SAMPLE) as Record<string, unknown>
  delete missingResource.deadlockDelta
  assert.throws(() => validateResourceSample(missingResource), /schema is invalid/)
  for (const badValue of ["0", Number.NaN, Number.NEGATIVE_INFINITY, -1, 0.25]) {
    assert.throws(
      () => validateResourceSample({ ...VALID_RESOURCE_SAMPLE, databaseGrowthBytes: badValue }),
      /nonnegative safe integer/,
    )
  }
})
