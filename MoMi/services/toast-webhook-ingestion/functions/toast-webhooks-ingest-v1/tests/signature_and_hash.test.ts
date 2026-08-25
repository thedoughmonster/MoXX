// service-owner: toast-webhook-ingestion

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import { processWebhook } from "../src/process_webhook.ts"
import type {
  IngestionDependencies,
  WebhookEnvelope,
} from "../src/types.ts"
import {
  correlationId,
  menusBody,
  restaurantGuid,
  secret,
  timestamp,
} from "./fixtures.ts"
import { signToastBody } from "./sign_toast_body.ts"

test("archives the signed body without authentication headers", async () => {
  const signature = await signToastBody(menusBody, timestamp, secret)
  const stored: WebhookEnvelope[] = []
  let requestedSecret = ""
  const dependencies: IngestionDependencies = {
    getSecret(secretName) {
      requestedSecret = secretName
      return secret
    },
    createCorrelationId() {
      return correlationId
    },
    store(savedEnvelope) {
      stored.push(savedEnvelope)
      return Promise.resolve("stored")
    },
  }
  const request = new Request("https://example.test/webhook", {
    method: "POST",
    headers: {
      "Toast-Signature": signature,
      Authorization: "Bearer authorization-secret",
      Cookie: "session=cookie-secret",
      apikey: "api-key-secret",
      "Webhook-Signature": "webhook-signature-secret",
    },
    body: menusBody,
  })

  const response = await processWebhook(request, dependencies)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, disposition: "stored" })
  assert.equal(requestedSecret, "TOAST_MENUS_WEBHOOK_SECRET")
  assert.equal(stored[0]?.restaurantGuid, restaurantGuid)
  assert.equal(stored[0]?.sourceOccurredAt, timestamp)
  assert.equal(Object.hasOwn(stored[0] ?? {}, "headers"), false)
  const persisted = JSON.stringify(stored[0])
  assert.equal(persisted.includes("authorization-secret"), false)
  assert.equal(persisted.includes("cookie-secret"), false)
  assert.equal(persisted.includes("api-key-secret"), false)
  assert.equal(persisted.includes("webhook-signature-secret"), false)
  assert.equal(stored[0]?.payload.details.sourceField !== undefined, true)
  assert.equal(stored[0]?.rawBody, menusBody)
  assert.equal(
    stored[0]?.contentHash,
    createHash("sha256").update(menusBody).digest("hex"),
  )
})

test("rejects a signature made with another subscription secret", async () => {
  const signature = await signToastBody(menusBody, timestamp, "wrong-secret")
  const dependencies: IngestionDependencies = {
    getSecret() {
      return secret
    },
    createCorrelationId() {
      return correlationId
    },
    store() {
      return Promise.reject(new Error("store must not run"))
    },
  }
  const response = await processWebhook(new Request("https://example.test", {
    method: "POST",
    headers: { "Toast-Signature": signature },
    body: menusBody,
  }), dependencies)

  assert.equal(response.status, 401)
})
