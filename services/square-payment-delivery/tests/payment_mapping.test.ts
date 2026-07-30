import assert from "node:assert/strict"
import test from "node:test"
import { buildCreatePaymentRequest } from "../src/build_create_payment_request.ts"
import { classifySquareEnvelope } from "../src/classify_square_envelope.ts"
import type { PaymentCommand } from "../src/types.ts"

const command: PaymentCommand = {
  payment_attempt_id: "70000000-0000-4000-8000-000000000274",
  owner_order_id: "70000000-0000-4000-8000-000000000273",
  amount_minor: 2400,
  currency: "USD",
  source_token: crypto.randomUUID(),
}

test("create request binds exact idempotency, order, location, and money", () => {
  const request = buildCreatePaymentRequest(
    command, "sandbox-location", crypto.randomUUID(), "2026-07-15",
  )
  const body = JSON.parse(String(request.init.body))
  assert.equal(request.url, "https://connect.squareupsandbox.com/v2/payments")
  assert.equal(body.idempotency_key, command.payment_attempt_id)
  assert.equal(body.reference_id, command.owner_order_id)
  assert.equal(body.location_id, "sandbox-location")
  assert.deepEqual(body.amount_money, { amount: 2400, currency: "USD" })
  assert.equal(body.source_id, command.source_token)
})

test("duplicate construction preserves one Square idempotency identity", () => {
  const secret = crypto.randomUUID()
  const first = buildCreatePaymentRequest(command, "sandbox-location", secret, "2026-07-15")
  const second = buildCreatePaymentRequest(command, "sandbox-location", secret, "2026-07-15")
  assert.equal(first.init.body, second.init.body)
})

test("success, pending, and decline map to deterministic safe states", () => {
  const common = {
    id: "sandbox-payment",
    reference_id: command.owner_order_id,
    location_id: "sandbox-location",
    amount_money: { amount: 2400, currency: "USD" },
  }
  assert.equal(classifySquareEnvelope({ payment: { ...common, status: "COMPLETED" } }, command, "sandbox-location").payment_status, "paid")
  assert.equal(classifySquareEnvelope({ payment: { ...common, status: "PENDING" } }, command, "sandbox-location").recovery, "retrieve")
  assert.equal(classifySquareEnvelope({ errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }] }, command, "sandbox-location").payment_status, "declined")
})

test("unknown and mismatched provider results fail indeterminate", () => {
  const mismatch = classifySquareEnvelope({ payment: {
    id: "sandbox-payment",
    status: "COMPLETED",
    reference_id: command.owner_order_id,
    location_id: "sandbox-location",
    amount_money: { amount: 2401, currency: "USD" },
  } }, command, "sandbox-location")
  assert.equal(mismatch.payment_status, "indeterminate")
  assert.equal(mismatch.recovery, "operator_review")
  assert.equal(classifySquareEnvelope({}, command, "sandbox-location").payment_status, "indeterminate")
})
