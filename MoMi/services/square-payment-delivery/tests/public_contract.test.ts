import assert from "node:assert/strict"
import test from "node:test"

import {
  executePayment,
  type PaymentExecutionCommand,
} from "../contracts/public/square.payment.execute.v1/index.ts"

const command: PaymentExecutionCommand = {
  payment_attempt_id: "70000000-0000-4000-8000-000000000274",
  owner_order_id: "70000000-0000-4000-8000-000000000273",
  amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
  source_token: crypto.randomUUID(),
}

test("public execution contract hides provider implementation and secrets", async () => {
  const evidence = await executePayment(command, {
    environment: {
      SQUARE_SANDBOX_ACCESS_TOKEN: crypto.randomUUID(),
      SQUARE_SANDBOX_LOCATION_ID: command.location_id,
      SQUARE_API_VERSION: "2026-07-15",
    },
    fetcher: async () => Response.json({ payment: {
      id: "sandbox-payment", status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z",
      reference_id: command.owner_order_id, location_id: command.location_id,
      amount_money: { amount: command.amount_minor, currency: command.currency },
    } }),
  })
  assert.equal(evidence.source, "delivery")
  assert.equal(evidence.disposition, "matched")
  assert.equal(evidence.payment_status, "paid")
  assert.equal("source_token" in evidence, false)
})

test("public execution contract rejects configured location drift without a call", async () => {
  let calls = 0
  const evidence = await executePayment(command, {
    environment: {
      SQUARE_SANDBOX_ACCESS_TOKEN: crypto.randomUUID(),
      SQUARE_SANDBOX_LOCATION_ID: "different-location",
      SQUARE_API_VERSION: "2026-07-15",
    },
    fetcher: async () => { calls += 1; return Response.json({}) },
  })
  assert.equal(calls, 0)
  assert.equal(evidence.disposition, "indeterminate")
  assert.equal(evidence.location_id, command.location_id)
})
