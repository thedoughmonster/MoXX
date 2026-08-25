import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)

const readMigration = (name: string) =>
  readFile(new URL(name, migrations), "utf8")

test("exposes complete webhook orders as immutable source versions", async () => {
  const source = await readMigration(
    "20260714090005_create_toast_order_source_versions_view.sql",
  )

  assert.match(source, /toast_order_source_versions_v1/)
  assert.match(source, /with \(security_invoker = true\)/)
  assert.match(source, /toast_raw\.orders/)
  assert.match(source, /toast_raw\.order_webhook_events/)
  assert.match(source, /'webhook:' \|\| \(event\.payload ->> 'guid'\)/)
  assert.match(source, /event\.payload #> '\{details,order\}'/)
  assert.match(source, /extensions\.digest/)
  assert.match(source, /union all/)
})

test("derives the same presentation and read contract from either source", async () => {
  const presentation = await readMigration(
    "20260714090014_read_webhook_order_presentations.sql",
  )
  const reader = await readMigration(
    "20260714090036_read_webhook_orders_by_id.sql",
  )

  assert.match(presentation, /toast_order_source_versions_v1/)
  assert.match(presentation, /'displayName'/)
  assert.doesNotMatch(presentation, /toast_raw\./)
  assert.match(reader, /toast_order_source_versions_v1/)
  assert.match(reader, /toast_order_alert_presentations_v1/)
  assert.doesNotMatch(reader, /toast_raw\./)
})

test("hands stored webhook identity directly to durable alert work", async () => {
  const source = await readMigration(
    "20260714090044_handoff_webhooks_to_order_alerts.sql",
  )

  assert.match(source, /drop trigger if exists enqueue_toast_order_hydration/)
  assert.match(source, /insert into momi_orders\.api_invocation_work/)
  assert.match(source, /'order_webhook_event'/)
  assert.match(source, /'webhook:' \|\| extracted\.event_id/)
  assert.match(source, /toast_hydration\.webhook_order_mappings/)
  assert.match(source, /momi_api\.read_view_registry/)
  assert.match(source, /on conflict/)
  assert.doesNotMatch(source, /order_hydration_jobs|net\.http|orders\/v2/)
})
