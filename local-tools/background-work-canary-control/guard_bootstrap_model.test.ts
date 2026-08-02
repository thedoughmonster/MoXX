import assert from "node:assert/strict"
import { test } from "node:test"
import { modelGuardBootstrap } from "./model_guard_bootstrap.ts"
import type { GuardBootstrapModelInput } from "./guard_bootstrap_types.ts"

const base: GuardBootstrapModelInput = {
  lockAcquired: true,
  targetIdentityMatches: true,
  targetsInactive: true,
  targetExecutions: 0,
  guardIdentityCount: 0,
  activeCronExecutions: 8,
  otherCronExecutions: 4,
  placeholderCount: 1,
  scheduledJobId: 12,
  readbackMatches: true,
  readbackHashesMatch: true,
}

test("bootstrap model succeeds at exact concurrency boundaries", () => {
  assert.deepEqual(modelGuardBootstrap(base), {
    outcome: "success",
    actions: [
      "begin", "try_advisory_lock", "lock_targets", "validate_targets",
      "validate_concurrency", "capture_db_clock", "materialize_expiry",
      "schedule_guard", "validate_readback", "emit_sanitized_receipt", "commit",
    ],
  })
})

test("every pre-schedule mismatch rolls back without scheduling", () => {
  const cases: [Partial<GuardBootstrapModelInput>, string][] = [
    [{ lockAcquired: false }, "lock_unavailable"],
    [{ targetIdentityMatches: false }, "target_identity_drift"],
    [{ targetsInactive: false }, "target_active"],
    [{ guardIdentityCount: 1 }, "guard_present"],
    [{ guardIdentityCount: 2 }, "guard_present"],
    [{ targetExecutions: 1 }, "target_execution_present"],
    [{ activeCronExecutions: 9 }, "active_cron_limit"],
    [{ otherCronExecutions: 5 }, "other_cron_limit"],
    [{ placeholderCount: 0 }, "placeholder_mismatch"],
    [{ placeholderCount: 2 }, "placeholder_mismatch"],
  ]
  for (const [change, outcome] of cases) {
    const result = modelGuardBootstrap({ ...base, ...change })
    assert.equal(result.outcome, outcome)
    assert.equal(result.actions.at(-1), "rollback")
    assert.ok(!result.actions.includes("schedule_guard"))
  }
})

test("schedule and readback failures roll back after the bounded attempt", () => {
  const schedule = modelGuardBootstrap({ ...base, scheduledJobId: 0 })
  assert.equal(schedule.outcome, "schedule_failed")
  assert.equal(schedule.actions.at(-1), "rollback")
  for (const change of [
    { readbackMatches: false },
    { readbackHashesMatch: false },
  ]) {
    const result = modelGuardBootstrap({ ...base, ...change })
    assert.equal(result.outcome, "readback_mismatch")
    assert.deepEqual(result.actions.slice(-2), ["validate_readback", "rollback"])
  }
})
