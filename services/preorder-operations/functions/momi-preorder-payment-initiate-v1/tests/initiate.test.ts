import assert from "node:assert/strict"
import test from "node:test"

import { handleRequestWithDependencies } from
  "../src/handle_request_with_dependencies.ts"
import { orchestrate } from "../src/orchestrate.ts"
import { parseRequest } from "../src/parse_request.ts"
import type { InitiateDependencies } from "../src/types.ts"

const orderId = "10000000-0000-4000-8000-000000000001"
const attemptId = "20000000-0000-4000-8000-000000000002"
const claimId = "30000000-0000-4000-8000-000000000003"
const input = {
  command_id: "40000000-0000-4000-8000-000000000004",
  order_id: orderId, expected_order_version: 1, source_token: "single-use-token",
}
const receipt = {
  outcome: "pending" as const, order_id: orderId, order_version: 2,
  payment_attempt_id: attemptId, payment_status: "pending" as const,
  amount: { currency: "USD", amount_minor: 2400 },
  next_actions: ["reconcile_payment"],
}

function dependencies(): InitiateDependencies {
  return {
    getLocationId: () => "sandbox-location",
    claim: () => Promise.resolve({ admitted: true, result: {
      disposition: "claimed", receipt, claim: {
        claim_id: claimId, claim_kind: "initiate",
        payment_attempt_id: attemptId, owner_order_id: orderId,
        amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
        provider_payment_id: null,
      },
    } }),
    deliver: () => Promise.resolve({
      evidence_id: "square:delivery:test", source: "delivery",
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

test("parses only the strict token-bearing public request", () => {
  assert.deepEqual(parseRequest(input), input)
  assert.equal(parseRequest({ ...input, source_token: "" }), null)
  assert.equal(parseRequest({ ...input, provider_payment_id: "forged" }), null)
})

test("claims before delivery and never sends the token to storage", async () => {
  const calls: string[] = []
  const deps = dependencies()
  deps.claim = (claimInput) => {
    calls.push(`claim:${JSON.stringify(claimInput)}`)
    return dependencies().claim(claimInput, "", "")
  }
  deps.deliver = (command) => {
    calls.push(`deliver:${command.source_token}`)
    return dependencies().deliver(command)
  }
  deps.project = (attempt, claim, evidence) => {
    calls.push(`project:${evidence.payment_status}`)
    return dependencies().project(attempt, claim, evidence)
  }
  const result = await orchestrate(input, "a".repeat(32), deps)
  assert.deepEqual(calls.map((call) => call.split(":")[0]), [
    "claim", "deliver", "project",
  ])
  assert.doesNotMatch(calls[0], /single-use-token/)
  assert.equal(result.result?.receipt?.payment_status, "paid")
})

test("does not call Square for replay, busy, terminal, or rate limit", async () => {
  for (const disposition of ["replay", "busy", "already_terminal"] as const) {
    const deps = dependencies()
    let delivered = false
    deps.claim = () => Promise.resolve({ admitted: true, result: {
      disposition, receipt, claim: null,
    } })
    deps.deliver = () => { delivered = true; return Promise.resolve(null) }
    const result = await orchestrate(input, "a".repeat(32), deps)
    assert.equal(result.result?.receipt?.payment_attempt_id, attemptId)
    assert.equal(delivered, false)
  }
  const deps = dependencies()
  deps.claim = () => Promise.resolve({ admitted: false, result: null })
  deps.deliver = () => { throw new Error("must not call Square") }
  const response = await handleRequestWithDependencies(new Request(
    "https://example.test", { method: "POST", body: JSON.stringify(input) },
  ), deps)
  assert.equal(response.status, 429)
})

test("durably projects transport ambiguity without leaking the token", async () => {
  const deps = dependencies()
  deps.deliver = () => { throw new Error(`provider failed: ${input.source_token}`) }
  let projected = ""
  deps.project = (_attempt, _claim, evidence) => {
    projected = JSON.stringify(evidence)
    return Promise.resolve({ disposition: "applied", receipt: {
      ...receipt, outcome: "indeterminate", payment_status: "indeterminate",
    } })
  }
  const result = await orchestrate(input, "a".repeat(32), deps)
  assert.equal(result.result?.receipt?.payment_status, "indeterminate")
  assert.doesNotMatch(projected, /single-use-token/)
  assert.match(projected, /momi:delivery:indeterminate:/)
})
