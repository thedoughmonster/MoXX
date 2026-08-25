import assert from "node:assert/strict"
import test from "node:test"

import { acquireSquarePayment } from "../src/acquire_square_payment.ts"
import { SQUARE_API_VERSION, SQUARE_SANDBOX_API_ORIGIN } from "../src/constants.ts"

test("retrieves provider state independently and requires exact parity", async () => {
  const expected = {
    providerPaymentId: "provider-payment", orderId: crypto.randomUUID(),
    amountMinor: 4200, currency: "USD", locationId: `sandbox-${crypto.randomUUID()}`,
  }
  const secret = crypto.randomUUID()
  const matched = await acquireSquarePayment(expected, secret, async (input, init) => {
    assert.equal(String(input), `${SQUARE_SANDBOX_API_ORIGIN}/v2/payments/provider-payment`)
    assert.equal(init?.method, "GET")
    assert.equal(new Headers(init?.headers).get("Square-Version"), SQUARE_API_VERSION)
    return Response.json({ payment: {
      id: expected.providerPaymentId, status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z",
      amount_money: { amount: expected.amountMinor, currency: expected.currency },
      location_id: expected.locationId, reference_id: expected.orderId,
    } })
  })
  const mismatch = await acquireSquarePayment(expected, secret, async () =>
    Response.json({ payment: {
      id: expected.providerPaymentId, status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z",
      amount_money: { amount: expected.amountMinor, currency: "CAD" },
      location_id: expected.locationId, reference_id: expected.orderId,
    } }))
  const missing = await acquireSquarePayment(expected, secret, async () =>
    Response.json({ errors: [{ code: "NOT_FOUND" }] }, { status: 404 }))

  assert.equal(matched.disposition, "matched")
  assert.equal(mismatch.disposition, "mismatch")
  assert.equal(missing.disposition, "missing")
  assert.equal(matched.paymentStatus, "paid")
  assert.equal(matched.providerUpdatedAt, "2026-07-31T15:30:00Z")
})
