import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)

test("anchors wrapped capture windows to the configured service date", async () => {
  const sql = await readFile(new URL(
    "20260714175723_schedule_warehouse_backbone_reconciliation.sql",
    migrations,
  ), "utf8")

  assert.doesNotMatch(sql, /capture_windows as window\b/i)
  assert.match(sql, /capture_windows as capture_window/)
  assert.match(sql, /values \(-1\), \(0\), \(1\)/)
  assert.match(sql, /observed\.local_at::date \+ candidate\.day_offset/)
  assert.match(sql, /extract\(dow from \(/)
  assert.match(sql, /capture_window\.effective_from/)
  assert.match(sql, /capture_window\.local_end < capture_window\.local_start/)
  assert.match(sql, /then interval '1 day'/)
})

test("schedules delivery retries only after their function exists", async () => {
  const earlyName = "20260714175723_schedule_warehouse_backbone_reconciliation.sql"
  const functionName = "20260714180028_create_momi_event_retry_functions.sql"
  const scheduleName = "20260714192250_schedule_momi_event_delivery_retries.sql"
  const early = await readFile(new URL(earlyName, migrations), "utf8")
  const later = await readFile(new URL(scheduleName, migrations), "utf8")

  assert.doesNotMatch(early, /momi-event-delivery-retries-v1/)
  assert.ok(scheduleName > functionName)
  assert.match(later, /momi-event-delivery-retries-v1/)
  assert.match(later, /momi_events\.enqueue_due_delivery_retries\(\)/)
})

test("records malformed raw processing without rejecting the raw row", async () => {
  const backbone = await readFile(new URL(
    "20260714175723_schedule_warehouse_backbone_reconciliation.sql",
    migrations,
  ), "utf8")
  const historical = await readFile(new URL(
    "20260714182753_create_toast_historical_backfill_planner.sql",
    migrations,
  ), "utf8")
  const ordering = await readFile(new URL(
    "20260714183739_add_online_ordering_sync_triggers.sql",
    migrations,
  ), "utf8")
  const discovery = await readFile(new URL(
    "20260714185415_automate_toast_backfill_and_group_discovery.sql",
    migrations,
  ), "utf8")
  const triggerSql = [historical, ordering, discovery].join("\n")

  assert.match(backbone, /create table toast_acquisition\.raw_processing_failures/)
  assert.match(backbone, /enable row level security/)
  assert.match(historical, /to_char\(parsed_date, 'YYYYMMDD'\) <> first_date/)
  for (const stage of [
    "capture_first_business_date",
    "sync_ordering_schedule_resource",
    "sync_ordering_schedule_webhook",
    "resync_ordering_schedule_policy",
    "enqueue_management_group_discovery",
  ]) assert.match(triggerSql, new RegExp(`'${stage}'`))
  assert.equal(triggerSql.match(/insert into toast_acquisition\.raw_processing_failures/g)?.length, 4)
  assert.equal(triggerSql.match(/exception when others then null/g)?.length, 4)
  assert.match(triggerSql, /'toast_raw\.resource_versions'/)
  assert.match(triggerSql, /'toast_raw\.webhook_events'/)
})
