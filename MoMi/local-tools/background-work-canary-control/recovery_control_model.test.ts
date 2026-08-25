import assert from "node:assert/strict"
import { test } from "node:test"
import { modelCleanup } from "./model_cleanup.ts"
import { modelRollback } from "./model_rollback.ts"

const rollbackBase = {
  childFresh: true, lockAcquired: true, targetIdentitiesMatch: true,
  guardState: "exact_active" as const, targetReadbackInactive: true,
  guardReadbackSafe: true,
}

test("rollback model orders fixed targets then handles exact guard last", () => {
  const result = modelRollback(rollbackBase)
  assert.equal(result.outcome, "rollback_succeeded_guard_deactivated")
  assert.deepEqual(result.actions.slice(5, 10), [
    "deactivate:3", "deactivate:2", "deactivate:11", "deactivate:4",
    "readback_targets",
  ])
  assert.ok(result.actions.indexOf("deactivate:guard") > result.actions.indexOf("deactivate:4"))
  assert.equal(result.actions.at(-1), "commit")
})

test("rollback absent/inactive guards succeed and failures preserve dead-man fallback", () => {
  assert.equal(modelRollback({ ...rollbackBase, guardState: "absent" }).outcome,
    "rollback_succeeded_guard_absent")
  assert.equal(modelRollback({ ...rollbackBase, guardState: "exact_inactive" }).outcome,
    "rollback_succeeded_guard_already_inactive")
  for (const change of [
    { childFresh: false }, { lockAcquired: false }, { targetIdentitiesMatch: false },
    { guardState: "drift" as const }, { targetReadbackInactive: false },
    { guardReadbackSafe: false },
  ]) {
    const result = modelRollback({ ...rollbackBase, ...change })
    assert.equal(result.actions.at(-1), "provider_deadman_fallback_preserved")
    assert.ok(!result.actions.includes("commit"))
  }
})

const cleanupBase = {
  childFresh: true, lockAcquired: true, targetsInactive: true,
  guardState: "exact_inactive" as const, unscheduleSucceeded: true,
  guardAbsentReadback: true,
}

test("cleanup is separate, target-gated, and idempotent for absent guard", () => {
  const removed = modelCleanup(cleanupBase)
  assert.equal(removed.outcome, "cleanup_succeeded_guard_removed")
  assert.ok(removed.actions.includes("unschedule_exact_guard"))
  const absent = modelCleanup({ ...cleanupBase, guardState: "absent" })
  assert.equal(absent.outcome, "cleanup_succeeded_guard_already_absent")
  assert.ok(!absent.actions.includes("unschedule_exact_guard"))
})

test("cleanup never unschedules active/drifted guard or while targets are active", () => {
  for (const change of [
    { targetsInactive: false }, { guardState: "exact_active" as const },
    { guardState: "drift" as const }, { lockAcquired: false },
  ]) {
    const result = modelCleanup({ ...cleanupBase, ...change })
    assert.equal(result.actions.at(-1), "rollback")
    assert.ok(!result.actions.includes("commit"))
  }
})
