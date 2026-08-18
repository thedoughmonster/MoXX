import assert from "node:assert/strict"
import test from "node:test"

import { handleRequestWithDependencies } from
  "../src/handle_request_with_dependencies.ts"
import { orchestrate } from "../src/orchestrate.ts"
import { parseRequest } from "../src/parse_request.ts"
import type { ReconcileDependencies } from "../src/types.ts"

const orderId = "10000000-0000-4000-8000-000000000001"
const attemptId = "20000000-0000-4000-8000-000000000002"
const claimId = "30000000-0000-4000-8000-000000000003"
const input = {
  command_id: "40000000-0000-4000-8000-000000000004",
  order_id: orderId, expected_order_version: 2, payment_attempt_id: attemptId,
}
const receipt = {
  outcome: "pending" as const, order_id: orderId, order_version: 2,
  payment_attempt_id: attemptId, payment_status: "pending" as const,
  amount: { currency: "USD", amount_minor: 2400 },
  next_actions: ["reconcile_payment"],
}

function dependencies(): ReconcileDependencies {
  return {
    getLocationId: () => "sandbox-location",
    claim: () => Promise.resolve({ admitted: true, result: {
      disposition: "claimed", receipt, claim: {
        claim_id: claimId, claim_kind: "reconcile",
        payment_attempt_id: attemptId, owner_order_id: orderId,
        amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
        provider_payment_id: "sandbox-payment",
      },
    } }),
    retrieve: () => Promise.resolve({
      evidence_id: "square:reconciliation:test", source: "reconciliation",
      disposition: "matched", payment_status: "paid",
      provider_payment_id: "sandbox-payment",
      provider_updated_at: "2026-07-31T18:00:00Z", order_id: orderId,
      amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
    }),
    project: (_attempt, _claim, evidence) => Promise.resolve({
      disposition: "applied", receipt: {
        ...receipt, outcome: "accepted", order_version: 3,
        payment_status: evidence.payment_status,
      },
    }),
  }
}

test("strictly parses owner recovery input", () => {
  assert.deepEqual(parseRequest(input), input)
  assert.equal(parseRequest({ ...input, provider_payment_id: "forged" }), null)
  assert.equal(parseRequest({ ...input, expected_order_version: 0 }), null)
})

test("claims before retrieval and projects canonical evidence", async () => {
  const calls: string[] = []
  const deps = dependencies()
  const originalClaim = deps.claim
  const originalRetrieve = deps.retrieve
  const originalProject = deps.project
  deps.claim = (...args) => { calls.push("claim"); return originalClaim(...args) }
  deps.retrieve = (expected) => {
    calls.push(`retrieve:${expected.provider_payment_id}`)
    return originalRetrieve(expected)
  }
  deps.project = (...args) => { calls.push("project"); return originalProject(...args) }
  const result = await orchestrate(input, "a".repeat(32), deps)
  assert.deepEqual(calls.map((call) => call.split(":")[0]), [
    "claim", "retrieve", "project",
  ])
  assert.equal(result.result?.receipt?.payment_status, "paid")
})

test("does not retrieve for busy, terminal, or operator review", async () => {
  for (const disposition of ["busy", "already_terminal", "operator_review"] as const) {
    const deps = dependencies()
    let retrieved = false
    deps.claim = () => Promise.resolve({ admitted: true, result: {
      disposition, receipt, claim: null,
    } })
    deps.retrieve = () => { retrieved = true; return Promise.resolve(null) }
    await orchestrate(input, "a".repeat(32), deps)
    assert.equal(retrieved, false)
  }
})

test("projects unavailable or malformed retrieval as indeterminate", async () => {
  for (const kind of ["unavailable", "malformed"] as const) {
    const deps = dependencies()
    deps.retrieve = kind === "unavailable"
      ? async () => { throw new Error("ambiguous retrieval") }
      : () => Promise.resolve({ disposition: "matched", payment_status: "paid" })
    let projected = ""
    deps.project = (_attempt, _claim, evidence) => {
      projected = JSON.stringify(evidence)
      return Promise.resolve({ disposition: "applied", receipt: { ...receipt,
        outcome: "indeterminate", payment_status: "indeterminate" } })
    }
    const result = await orchestrate(input, "a".repeat(32), deps)
    assert.equal(result.result?.receipt?.payment_status, "indeterminate")
    assert.match(projected, /momi:reconciliation:indeterminate:/)
    assert.doesNotMatch(projected, /paid/)
  }
})

test("returns 429 before retrieval when admission rejects", async () => {
  const deps = dependencies()
  deps.claim = () => Promise.resolve({ admitted: false, result: null })
  deps.retrieve = () => { throw new Error("must not retrieve") }
  const response = await handleRequestWithDependencies(new Request(
    "https://example.test", { method: "POST", body: JSON.stringify(input) },
  ), deps)
  assert.equal(response.status, 429)
})
