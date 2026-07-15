// service-owner: toast-order-ingest

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("stores legacy and central order envelopes in one transaction", async () => {
  const source = await readFile(
    new URL("../src/store_raw_order_event.ts", import.meta.url),
    "utf8",
  )
  const handler = await readFile(
    new URL("../src/handle_request.ts", import.meta.url),
    "utf8",
  )

  assert.match(source, /rawBody: string/)
  assert.match(source, /new TextEncoder\(\)\.encode\(rawBody\)/)
  assert.match(source, /sql\.begin/)
  assert.match(source, /toast_raw\.order_webhook_events/)
  assert.match(source, /toast_raw\.webhook_events/)
  assert.match(source, /source_occurred_at/)
  assert.match(source, /transaction\.json\(\{\}\)/)
  assert.match(source, /raw_body, raw_body_exact/)
  assert.match(source, /on conflict \(event_guid\) do update/)
  assert.match(source, /archived\.raw_body is null/)
  assert.match(source, /archived\.content_hash = excluded\.content_hash/)
  assert.match(source, /legacyRows\.length === 1 \? "stored" : "duplicate"/)
  assert.doesNotMatch(source, /headers: Record<string, string>/)
  assert.doesNotMatch(handler, /Object\.fromEntries\(request\.headers/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
})
