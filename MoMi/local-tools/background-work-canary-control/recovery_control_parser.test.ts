import assert from "node:assert/strict"
import { test } from "node:test"
import { parseCleanupOutput } from "./parse_cleanup_output.ts"
import { parseRollbackOutput } from "./parse_rollback_output.ts"
import { CLEANUP_MARKER, ROLLBACK_MARKER } from "./recovery_control_constants.ts"
import {
  encodeRecoveryResult,
  VALID_CLEANUP_RESULT,
  VALID_RECOVERY_CONTROL_INPUT,
  VALID_ROLLBACK_ABSENT_RESULT,
  VALID_ROLLBACK_INACTIVE_RESULT,
} from "./recovery_control.test_fixture.ts"

test("rollback parser accepts exact absent and inactive guard terminal states", () => {
  for (const result of [VALID_ROLLBACK_ABSENT_RESULT, VALID_ROLLBACK_INACTIVE_RESULT]) {
    assert.deepEqual(parseRollbackOutput(
      encodeRecoveryResult(ROLLBACK_MARKER, result), VALID_RECOVERY_CONTROL_INPUT,
    ), result)
  }
})

test("rollback parser rejects target, guard, identity-count, and raw-field drift", () => {
  const changes = [
    { targetJobs: VALID_ROLLBACK_ABSENT_RESULT.targetJobs.map((job, index) =>
      index === 0 ? { ...job, active: true } : job) },
    { guardIdentityCount: 2 },
    { guardPresent: true },
    { guardJobId: 13 },
    { guard: { ...VALID_ROLLBACK_ABSENT_RESULT.guard, active: true } },
    { guardState: "guard_inactive" },
    { command: "raw command" },
  ]
  for (const change of changes) assert.throws(() => parseRollbackOutput(
    encodeRecoveryResult(ROLLBACK_MARKER, {
      ...VALID_ROLLBACK_ABSENT_RESULT, ...change,
    }), VALID_RECOVERY_CONTROL_INPUT,
  ))
})

test("cleanup parser accepts only exact target-inactive guard absence", () => {
  assert.deepEqual(parseCleanupOutput(
    encodeRecoveryResult(CLEANUP_MARKER, VALID_CLEANUP_RESULT),
    VALID_RECOVERY_CONTROL_INPUT,
  ), VALID_CLEANUP_RESULT)
  for (const change of [
    { guardIdentityCount: 1 }, { guardPresent: true }, { guardJobId: 12 },
    { guardState: "guard_inactive" },
    { targetJobs: VALID_CLEANUP_RESULT.targetJobs.map((job, index) =>
      index === 3 ? { ...job, active: true } : job) },
    { extra: true },
  ]) assert.throws(() => parseCleanupOutput(
    encodeRecoveryResult(CLEANUP_MARKER, { ...VALID_CLEANUP_RESULT, ...change }),
    VALID_RECOVERY_CONTROL_INPUT,
  ))
})
