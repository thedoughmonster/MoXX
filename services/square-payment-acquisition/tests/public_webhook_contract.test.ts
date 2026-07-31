import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { authenticateWebhookEvidence } from
  "../contracts/public/square.payment.webhook.authenticate.v1/index.ts"

test("public webhook contract authenticates exact bytes and emits evidence", async () => {
  const notificationUrl = "https://example.test/functions/v1/square-payment-webhook-v1"
  const signatureKey = crypto.randomUUID()
  const orderId = crypto.randomUUID()
  const rawBody = new TextEncoder().encode(JSON.stringify({
    event_id: "sandbox-event", type: "payment.updated",
    data: { object: { payment: {
      id: "sandbox-payment", status: "COMPLETED",
      updated_at: "2026-07-31T15:30:00Z", reference_id: orderId,
      location_id: "sandbox-location",
      amount_money: { amount: 2400, currency: "USD" },
    } } },
  }))
  const signature = createHmac("sha256", signatureKey)
    .update(notificationUrl).update(rawBody).digest("base64")
  const result = await authenticateWebhookEvidence(
    { raw_body: rawBody, signature },
    { environment: {
      SQUARE_WEBHOOK_SIGNATURE_KEY: signatureKey,
      SQUARE_WEBHOOK_NOTIFICATION_URL: notificationUrl,
      SQUARE_SANDBOX_LOCATION_ID: "sandbox-location",
      SQUARE_SANDBOX_ACCESS_TOKEN: crypto.randomUUID(),
    } },
  )
  assert.equal(result.disposition, "authenticated")
  assert.equal(result.evidence?.source, "webhook")
  assert.equal(result.evidence?.payment_status, "paid")
  assert.equal(result.evidence?.order_id, orderId)
  assert.equal("raw_body" in (result.evidence ?? {}), false)
})
