import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { authenticateSquareWebhook } from "../src/authenticate_square_webhook.ts"
import { buildWebhookEvidence } from "../src/build_webhook_evidence.ts"

const notificationUrl = "https://example.test/functions/v1/square-payment-webhook-v1"
const signatureKey = crypto.randomUUID()

test("authenticates before parsing and maps a payment event", async () => {
  const orderId = crypto.randomUUID()
  const raw = new TextEncoder().encode(JSON.stringify({
    event_id: "payment-event", type: "payment.updated",
    data: { object: { payment: {
      id: "sandbox-payment", status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z", reference_id: orderId,
      location_id: "sandbox-location",
      amount_money: { amount: 2400, currency: "USD" },
    } } },
  }))
  const signature = createHmac("sha256", signatureKey)
    .update(notificationUrl).update(raw).digest("base64")
  const event = await authenticateSquareWebhook(
    raw, signature, signatureKey, notificationUrl,
  )
  assert.ok(event)
  const result = await buildWebhookEvidence(event, crypto.randomUUID())
  assert.equal(result.errorCode, null)
  assert.equal(result.evidence?.evidence_id.startsWith("square:webhook:sha256:"), true)
  assert.equal(result.evidence?.payment_status, "paid")
  assert.equal(result.evidence?.order_id, orderId)

  const changed = new TextEncoder().encode(new TextDecoder().decode(raw) + " ")
  assert.equal(await authenticateSquareWebhook(
    changed, signature, signatureKey, notificationUrl,
  ), null)
})

test("retrieves refund payment linkage and fails closed on partial money", async () => {
  const raw = new TextEncoder().encode(JSON.stringify({
    event_id: "refund-event", type: "refund.updated",
    data: { object: { refund: {
      id: "sandbox-refund", payment_id: "sandbox-payment", status: "PENDING",
      updated_at: "2026-07-31T15:31:00Z", location_id: "sandbox-location",
      amount_money: { amount: 1000, currency: "USD" },
    } } },
  }))
  const signature = createHmac("sha256", signatureKey)
    .update(notificationUrl).update(raw).digest("base64")
  const event = await authenticateSquareWebhook(
    raw, signature, signatureKey, notificationUrl,
  )
  assert.ok(event)
  const orderId = crypto.randomUUID()
  const result = await buildWebhookEvidence(
    event, crypto.randomUUID(), async () => Response.json({ payment: {
      id: "sandbox-payment", status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z", reference_id: orderId,
      location_id: "sandbox-location",
      amount_money: { amount: 2400, currency: "USD" },
    } }),
  )
  assert.equal(result.evidence?.payment_status, "refund_pending")
  assert.equal(result.evidence?.disposition, "mismatch")
  assert.equal(result.evidence?.order_id, orderId)
  assert.equal(result.evidence?.amount_minor, 2400)
  assert.equal(result.errorCode, "provider_identity_mismatch")
})
