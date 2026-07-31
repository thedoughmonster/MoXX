import assert from "node:assert/strict"
import test from "node:test"

import {
  retrievePayment,
  type PaymentRetrievalCommand,
} from "../contracts/public/square.payment.retrieve.v1/index.ts"

test("public retrieval contract returns only canonical evidence", async () => {
  const command: PaymentRetrievalCommand = {
    provider_payment_id: "sandbox-payment", order_id: crypto.randomUUID(),
    amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
  }
  const evidence = await retrievePayment(command, {
    environment: {
      SQUARE_SANDBOX_ACCESS_TOKEN: crypto.randomUUID(),
      SQUARE_SANDBOX_LOCATION_ID: command.location_id,
    },
    fetcher: async () => Response.json({ payment: {
      id: command.provider_payment_id, status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z", reference_id: command.order_id,
      location_id: command.location_id,
      amount_money: { amount: command.amount_minor, currency: command.currency },
    } }),
  })
  assert.equal(evidence.source, "reconciliation")
  assert.equal(evidence.disposition, "matched")
  assert.equal(evidence.payment_status, "paid")
  assert.equal(evidence.provider_payment_id, command.provider_payment_id)
  assert.equal("providerRequestId" in evidence, false)
})
