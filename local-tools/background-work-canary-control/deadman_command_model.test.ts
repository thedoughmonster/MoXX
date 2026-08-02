import assert from "node:assert/strict"
import { test } from "node:test"
import { modelDeadmanInvocation } from "./model_deadman_invocation.ts"

const base = {
  invocationGeneration: "generation-a",
  currentGeneration: "generation-a",
  nowUtcMs: 1_000,
  expiryUtcMs: 1_000,
  guardIdentityCount: 1,
  exactIdentityMask: 15,
  activeBeforeMask: 0,
  inactiveAfterMask: 15,
}

test("stale generation and before-expiry invocations are lock-only no-ops", () => {
  assert.deepEqual(modelDeadmanInvocation({
    ...base, currentGeneration: "generation-b",
  }), { outcome: "stale_generation", actions: ["advisory_lock"] })
  assert.deepEqual(modelDeadmanInvocation({
    ...base, nowUtcMs: 999,
  }), { outcome: "before_expiry", actions: ["advisory_lock"] })
})

test("expiry deactivates exact consumers upstream-first and persists before guard last", () => {
  assert.deepEqual(modelDeadmanInvocation(base), {
    outcome: "deactivated",
    actions: [
      "advisory_lock", "deactivate:3", "deactivate:2", "deactivate:11",
      "persist:terminal_evidence", "deactivate:guard",
    ],
  })
})

test("identity reassignment is recorded without mutating the reassigned ID", () => {
  for (const drift of [{ exactIdentityMask: 14 }, { exactIdentityMask: 7 }]) {
    const result = modelDeadmanInvocation({ ...base, ...drift })
    assert.equal(result.outcome, "deactivated_manual_evidence")
    const missing = drift.exactIdentityMask === 14 ? "deactivate:2" : "deactivate:11"
    assert.equal(result.actions.includes(missing), false)
    assert.deepEqual(result.actions.slice(-2),
      ["persist:terminal_evidence", "deactivate:guard"])
  }
})

test("active-before and incomplete inactive-after evidence cannot false-pass", () => {
  for (const drift of [{ activeBeforeMask: 1 }, { inactiveAfterMask: 14 }]) {
    assert.equal(modelDeadmanInvocation({ ...base, ...drift }).outcome,
      "deactivated_manual_evidence")
  }
})

test("missing or duplicate guard identity stops before any target action", () => {
  for (const guardIdentityCount of [0, 2]) {
    assert.deepEqual(modelDeadmanInvocation({ ...base, guardIdentityCount }), {
      outcome: "guard_identity_error", actions: ["advisory_lock"],
    })
  }
})
