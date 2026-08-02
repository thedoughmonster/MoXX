// service-owner: toast-webhook-ingestion

import assert from "node:assert/strict"
import test from "node:test"

import { processWebhook } from "../src/process_webhook.ts"
import type {
  IngestionDependencies,
  WebhookEnvelope,
} from "../src/types.ts"
import { signToastBody } from "./sign_toast_body.ts"

test("durably accepts fresh and old signed unseen order events", async () => {
  const secret = "orders-freshness-secret"
  const freshTimestamp = new Date().toISOString()
  const oldTimestamp = "2024-06-21T00:00:00.000Z"
  const saved: WebhookEnvelope[] = []
  const dependencies: IngestionDependencies = {
    getSecret() {
      return secret
    },
    createCorrelationId() {
      return crypto.randomUUID()
    },
    store(envelope) {
      saved.push(envelope)
      return Promise.resolve("stored")
    },
  }
  const cases = [
    {
      timestamp: freshTimestamp,
      eventGuid: "44444444-4444-4444-8444-444444444444",
      orderGuid: "55555555-5555-4555-8555-555555555555",
    },
    {
      timestamp: oldTimestamp,
      eventGuid: "66666666-6666-4666-8666-666666666666",
      orderGuid: "77777777-7777-4777-8777-777777777777",
    },
  ]

  for (const event of cases) {
    const rawBody = JSON.stringify({
      guid: event.eventGuid,
      timestamp: event.timestamp,
      eventCategory: "order_updated",
      eventType: "order_updated",
      details: {
        restaurantGuid: "22222222-2222-4222-8222-222222222222",
        order: { guid: event.orderGuid },
      },
    })
    const signature = await signToastBody(rawBody, event.timestamp, secret)
    const response = await processWebhook(new Request("https://example.test", {
      method: "POST",
      headers: { "Toast-Signature": signature },
      body: rawBody,
    }), dependencies)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, disposition: "stored" })
  }

  assert.equal(saved.length, 2)
  assert.equal(saved[0]?.sourceOccurredAt, freshTimestamp)
  assert.equal(saved[1]?.sourceOccurredAt, oldTimestamp)
  assert.notEqual(saved[0]?.eventGuid, saved[1]?.eventGuid)
})
