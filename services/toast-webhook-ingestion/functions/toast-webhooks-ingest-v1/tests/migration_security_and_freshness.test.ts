// service-owner: toast-webhook-ingestion

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../../../../../supabase/migrations/", import.meta.url)

test("database rejects authentication headers across webhook archives", async () => {
  const source = await readFile(new URL(
    "20260715061136_harden_toast_webhook_headers.sql",
    migrations,
  ), "utf8")

  assert.match(source, /pg_catalog\.lower\(header\.name\)/)
  assert.match(source, /auth\|cookie\|credential\|session\|signature/)
  assert.match(source, /api\[-_\]\?key\|apikey\|token\|secret/)
  assert.match(source, /update toast_raw\.order_webhook_events set headers = '\{\}'/)
  assert.match(source, /update toast_raw\.stock_webhook_events set headers = '\{\}'/)
  assert.match(source, /update toast_raw\.webhook_events set headers = '\{\}'/)
  assert.match(source, /check \(headers = '\{\}'::jsonb and/)
  assert.match(source, /order_webhook_events_safe_headers/)
  assert.match(source, /stock_webhook_events_safe_headers/)
  assert.match(source, /webhook_events_safe_headers/)
})

test("classifies signed order source time against database freshness", async () => {
  const [archive, sourceEvents, classification] = await Promise.all([
    readFile(new URL(
      "20260714174938_create_toast_webhook_envelopes.sql",
      migrations,
    ), "utf8"),
    readFile(new URL(
      "20260714175728_emit_source_toast_events.sql",
      migrations,
    ), "utf8"),
    readFile(new URL(
      "20260714185940_classify_canonical_order_events.sql",
      migrations,
    ), "utf8"),
  ])

  assert.match(archive, /observed_freshness_window interval not null/)
  assert.match(archive, /source_occurred_at timestamptz not null/)
  assert.match(archive, /payload ->> 'timestamp'.*= source_occurred_at/)
  assert.match(sourceEvents, /new\.source_occurred_at/)
  assert.doesNotMatch(sourceEvents, /new\.received_at/)
  assert.match(classification, /join toast_raw\.webhook_subscriptions/)
  assert.match(classification, /source_occurred_at between/)
  assert.match(classification, /received_at - webhook_event\.observed_freshness_window/)
  assert.match(classification, /received_at \+ webhook_event\.observed_freshness_window/)
  assert.match(classification, /then 'warehouse\.order\.observed'/)
  assert.match(classification, /else 'warehouse\.order\.reconciled'/)
})
