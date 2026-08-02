import assert from "node:assert/strict"
import { test } from "node:test"
import type { GuardHeartbeatModelInput } from "./guard_heartbeat_types.ts"
import { modelGuardHeartbeat } from "./model_guard_heartbeat.ts"

const base: GuardHeartbeatModelInput = {
  lockAcquired: true,
  guardIdentityCount: 1,
  guardIdentityMatches: true,
  guardActive: true,
  currentCommandMatches: true,
  currentExpiryValid: true,
  targetIdentityMatches: true,
  targetsInactive: true,
  targetExecutions: 0,
  placeholderCount: 1,
  alterSucceeded: true,
  readbackMatches: true,
  readbackHashesMatch: true,
}

test("heartbeat model rotates one validated generation and commits", () => {
  assert.deepEqual(modelGuardHeartbeat(base), {
    outcome: "success",
    actions: [
      "begin", "try_advisory_lock", "read_guard", "validate_current_guard",
      "read_targets", "validate_targets", "capture_db_clock", "materialize_next",
      "alter_guard", "validate_readback", "emit_sanitized_receipt", "commit",
    ],
  })
})

test("every pre-alter heartbeat mismatch rolls back without mutation", () => {
  const cases: [Partial<GuardHeartbeatModelInput>, string][] = [
    [{ lockAcquired: false }, "lock_unavailable"],
    [{ guardIdentityCount: 0 }, "guard_identity_error"],
    [{ guardIdentityCount: 2 }, "guard_identity_error"],
    [{ guardIdentityMatches: false }, "guard_identity_error"],
    [{ guardActive: false }, "guard_inactive"],
    [{ currentCommandMatches: false }, "current_command_mismatch"],
    [{ targetIdentityMatches: false }, "target_identity_drift"],
    [{ targetsInactive: false }, "target_active"],
    [{ targetExecutions: 1 }, "target_execution_present"],
    [{ placeholderCount: 0 }, "placeholder_mismatch"],
    [{ placeholderCount: 2 }, "placeholder_mismatch"],
    [{ currentExpiryValid: false }, "current_expired"],
  ]
  for (const [change, outcome] of cases) {
    const result = modelGuardHeartbeat({ ...base, ...change })
    assert.equal(result.outcome, outcome)
    assert.equal(result.actions.at(-1), "rollback")
    assert.ok(!result.actions.includes("alter_guard"))
  }
})

test("alter and readback failures roll back the prior generation", () => {
  const alter = modelGuardHeartbeat({ ...base, alterSucceeded: false })
  assert.equal(alter.outcome, "alter_failed")
  assert.deepEqual(alter.actions.slice(-2), ["alter_guard", "rollback"])
  for (const change of [{ readbackMatches: false }, { readbackHashesMatch: false }]) {
    const result = modelGuardHeartbeat({ ...base, ...change })
    assert.equal(result.outcome, "readback_mismatch")
    assert.deepEqual(result.actions.slice(-2), ["validate_readback", "rollback"])
  }
})
