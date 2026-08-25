import assert from "node:assert/strict"
import test from "node:test"

import { executeSquareRefund } from "../src/execute_square_refund.ts"
import type { RefundCommand } from "../src/types.ts"

const command: RefundCommand = {
  refund_attempt_id: "70000000-0000-4000-8000-000000000275",
  provider_payment_id: "sandbox-payment",
  owner_order_id: "70000000-0000-4000-8000-000000000273",
  amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
}

test("refunds through one stable Sandbox idempotency identity", async () => {
  let requestBody: Record<string, unknown> = {}
  const receipt = await executeSquareRefund(
    command, crypto.randomUUID(), "2026-07-15", async (input, init) => {
      assert.equal(String(input), "https://connect.squareupsandbox.com/v2/refunds")
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ refund: {
        id: "sandbox-refund", status: "PENDING",
        payment_id: command.provider_payment_id,
        location_id: command.location_id,
        updated_at: "2026-07-31T15:31:00Z",
        amount_money: { amount: command.amount_minor, currency: command.currency },
      } }, { headers: { "x-request-id": "sandbox-refund-request" } })
    },
  )
  assert.equal(requestBody.idempotency_key, command.refund_attempt_id)
  assert.equal(requestBody.payment_id, command.provider_payment_id)
  assert.deepEqual(requestBody.amount_money, { amount: 2400, currency: "USD" })
  assert.equal(receipt.payment_status, "refund_pending")
  assert.equal(receipt.provider_refund_id, "sandbox-refund")
})

test("refund timeout stays indeterminate without blind retry", async () => {
  const receipt = await executeSquareRefund(
    command, crypto.randomUUID(), "2026-07-15",
    async () => { throw new Error("sandbox unavailable") },
  )
  assert.equal(receipt.payment_status, "indeterminate")
  assert.equal(receipt.recovery, "retrieve")
})
