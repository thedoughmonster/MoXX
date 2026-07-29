import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { verifySquareWebhookSignature } from "../src/verify_square_webhook_signature.ts"

test("verifies the exact notification URL and raw request bytes", async () => {
  const rawBody = new TextEncoder().encode('{"type":"payment.updated","event_id":"evt-1"}')
  const notificationUrl = "https://example.test/functions/v1/square-payment-webhook-v1"
  const signatureKey = crypto.randomUUID()
  const signature = createHmac("sha256", signatureKey)
    .update(notificationUrl).update(rawBody).digest("base64")

  assert.equal(await verifySquareWebhookSignature(
    rawBody, signature, signatureKey, notificationUrl,
  ), true)
  assert.equal(await verifySquareWebhookSignature(
    new TextEncoder().encode('{"event_id":"evt-1","type":"payment.updated"}'),
    signature, signatureKey, notificationUrl,
  ), false)
  assert.equal(await verifySquareWebhookSignature(
    rawBody, signature, signatureKey, `${notificationUrl}/changed`,
  ), false)
  assert.equal(await verifySquareWebhookSignature(rawBody, "not-base64!", signatureKey, notificationUrl), false)
})
