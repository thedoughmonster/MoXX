import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { authenticateSquareWebhook } from "../src/authenticate_square_webhook.ts"
import { buildWebhookEvidence } from "../src/build_webhook_evidence.ts"

test("acknowledges unrelated Square payment evidence without projection", async () => {
  const notificationUrl = "https://example.test/functions/v1/square-payment-webhook-v1"
  const signatureKey = crypto.randomUUID()
  const raw = new TextEncoder().encode(JSON.stringify({
    event_id: "unowned-event", type: "payment.updated",
    data: { object: { payment: {
      id: "unowned-payment", status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z",
      reference_id: "seller-owned-reference",
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

  assert.equal(result.evidence, null)
  assert.equal(result.retryable, false)
  assert.equal(result.errorCode, "unowned_provider_event")
})
