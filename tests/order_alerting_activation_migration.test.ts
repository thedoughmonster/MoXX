import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../supabase/migrations/20260716144455_activate_source_neutral_order_alerts.sql",
  import.meta.url,
)

test("cuts over order alerts without an ingestion race", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /lock table toast_raw\.order_webhook_events/)
  assert.match(sql, /lock table momi_events\.events/)
  assert.match(sql, /set local lock_timeout = '5s'/)
  assert.match(sql, /set local statement_timeout = '30s'/)
  assert.match(sql, /activation_floor.*clock_timestamp\(\) - interval '1 minute'/s)
  assert.match(sql, /minimum_recorded_at = activation_floor/)
  assert.match(sql, /event_name = 'warehouse\.order\.observed'/)
  assert.match(sql, /status = 'retry_wait'/)
})

test("deduplicates legacy and canonical source identities", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /prevent_cross_path_order_alert_duplicate/)
  assert.match(sql, /decision_context ->> 'source_order_id'/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /before insert on momi_alerting\.order_alert_candidates/)
})

test("activates exact canonical alerting and the preorder destination", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /momi\.orders\.get_by_version\.v1/)
  assert.match(sql, /order_versions_by_id_v1/)
  assert.match(sql, /source_key = 'dm_order'/)
  assert.match(sql, /alert_kind in \('new_order', 'preorder'\)/)
  assert.match(sql, /submission_cutoff_local = time '17:00'/)
  assert.match(sql, /slack_channel_id = 'C0A5VPD6TJT'/)
  assert.match(sql, /momi-order-alert-event-wakeup-v1/)
})

test("stops only new legacy work and preserves terminal records", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /update toast_hydration\.webhook_order_mappings/)
  assert.match(sql, /set is_enabled = false/)
  assert.match(sql, /Legacy order alert work is not terminal/)
  assert.match(sql, /Legacy order alert producer gate is not ready/)
  assert.doesNotMatch(sql, /delete from momi_orders\.api_invocation_work/)
  assert.doesNotMatch(sql, /drop function.*toast_orders/s)
})
