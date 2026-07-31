import assert from "node:assert/strict"
import test from "node:test"

import { buildDeliveryEvidence } from "../src/build_delivery_evidence.ts"
import { executeSquarePayment } from "../src/execute_square_payment.ts"

test("builds deterministic owner-projectable delivery evidence", async () => {
  const command = {
    payment_attempt_id: "70000000-0000-4000-8000-000000000274",
    owner_order_id: "70000000-0000-4000-8000-000000000273",
    amount_minor: 2400 as const, currency: "USD" as const,
    source_token: crypto.randomUUID(),
  }
  const receipt = await executeSquarePayment(
    command, "sandbox-location", crypto.randomUUID(), "2026-07-15",
    async () => Response.json({ payment: {
      id: "sandbox-payment", status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z",
      reference_id: command.owner_order_id, location_id: "sandbox-location",
      amount_money: { amount: 2400, currency: "USD" },
    } }, { headers: { "x-request-id": "sandbox-request" } }),
  )
  const first = await buildDeliveryEvidence(command, "sandbox-location", receipt)
  const replay = await buildDeliveryEvidence(command, "sandbox-location", receipt)

  assert.deepEqual(first, replay)
  assert.equal(first.disposition, "matched")
  assert.equal(first.payment_status, "paid")
  assert.equal(first.provider_payment_id, "sandbox-payment")
  assert.equal(first.provider_updated_at, "2026-07-31T15:30:00Z")
  assert.equal(first.order_id, command.owner_order_id)
  assert.equal(first.amount_minor, command.amount_minor)
  assert.equal(first.evidence_id.startsWith("square:delivery:sha256:"), true)
  assert.equal("source_token" in first, false)
})
