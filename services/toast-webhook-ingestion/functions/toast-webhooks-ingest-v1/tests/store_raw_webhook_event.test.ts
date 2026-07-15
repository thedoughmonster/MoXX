// service-owner: toast-webhook-ingestion

import assert from "node:assert/strict"
import test from "node:test"

import { storeRawWebhookEvent } from "../src/store_raw_webhook_event.ts"
import type { Database } from "../src/types.ts"
import { envelope } from "./fixtures.ts"

test("inserts the complete envelope and reports database duplicates", async () => {
  let query = ""
  let values: unknown[] = []
  const results: Record<string, unknown>[][] = [[{ id: 1 }]]
  const database = Object.assign(
    (strings: TemplateStringsArray, ...parameters: unknown[]) => {
      query = strings.join("?")
      values = parameters
      return Promise.resolve(results.shift() ?? [])
    },
    {
      json(value: unknown) {
        return value
      },
    },
  ) as Database

  assert.equal(await storeRawWebhookEvent(database, envelope), "stored")
  assert.match(query, /insert into toast_raw\.webhook_events/)
  assert.match(query, /event_guid/)
  assert.match(query, /subscription_key/)
  assert.match(query, /restaurant_guid/)
  assert.match(query, /correlation_id/)
  assert.match(query, /source_occurred_at/)
  assert.match(query, /headers/)
  assert.match(query, /payload/)
  assert.match(query, /raw_body/)
  assert.match(query, /raw_body_exact/)
  assert.match(query, /content_hash/)
  assert.match(query, /handler_version/)
  assert.match(query, /on conflict \(event_guid\) do update/)
  assert.match(query, /archived\.raw_body is null/)
  assert.match(query, /archived\.content_hash = excluded\.content_hash/)
  assert.equal(values.some((value) => JSON.stringify(value) === "{}"), true)
  assert.equal(JSON.stringify(values).includes("signature"), false)
  assert.equal(values.includes(envelope.sourceOccurredAt), true)
  assert.equal(values.includes(envelope.payload), true)
  assert.equal(values.includes(envelope.rawBody), true)

  results.push([], [{ content_hash: envelope.contentHash }])
  assert.equal(await storeRawWebhookEvent(database, envelope), "duplicate")

  results.push([], [{ content_hash: "f".repeat(64) }])
  await assert.rejects(
    storeRawWebhookEvent(database, envelope),
    /event GUID content conflict/,
  )
})
