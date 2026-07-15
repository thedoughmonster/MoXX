import assert from "node:assert/strict"
import test from "node:test"

import { processWebhook } from "../src/process_webhook.ts"
import type { IngestionDependencies } from "../src/types.ts"
import {
  correlationId,
  eventGuid,
  menusBody,
  secret,
  timestamp,
} from "./fixtures.ts"
import { signToastBody } from "./sign_toast_body.ts"

test("acknowledges a replay as a successful duplicate", async () => {
  const signature = await signToastBody(menusBody, timestamp, secret)
  const seen = new Set<string>()
  const dependencies: IngestionDependencies = {
    getSecret() {
      return secret
    },
    createCorrelationId() {
      return correlationId
    },
    store(savedEnvelope) {
      if (seen.has(savedEnvelope.eventGuid)) {
        return Promise.resolve("duplicate")
      }
      seen.add(savedEnvelope.eventGuid)
      return Promise.resolve("stored")
    },
  }
  const request = () => new Request("https://example.test/webhook", {
    method: "POST",
    headers: { "Toast-Signature": signature },
    body: menusBody,
  })

  const first = await processWebhook(request(), dependencies)
  const replay = await processWebhook(request(), dependencies)

  assert.deepEqual(await first.json(), { ok: true, disposition: "stored" })
  assert.deepEqual(await replay.json(), { ok: true, disposition: "duplicate" })
  assert.deepEqual([...seen], [eventGuid])
})
