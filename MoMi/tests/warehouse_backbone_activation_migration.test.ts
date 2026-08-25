import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../supabase/migrations/20260715091810_activate_warehouse_event_backbone.sql",
  import.meta.url,
)

test("activates routing, projection, and every canonical reader", async () => {
  const sql = await readFile(migration, "utf8")

  for (const key of [
    "momi.events.route.v1",
    "momi.warehouse_projection.toast.consume.v1",
    "momi.orders.get_by_id.v1",
    "momi.employees.get_by_id.v1",
    "momi.menu_entities.get_by_id.v1",
    "momi.payments.get_by_id.v1",
    "momi.schedules.get_by_id.v1",
    "momi.stock_observations.get_latest.v1",
  ]) assert.match(sql, new RegExp(key.replaceAll(".", "\\.")))
  assert.match(sql, /warehouse-projection-toast-v1/)
  assert.match(sql, /set active = true/)
})

test("activates only backbone recovery cron jobs", async () => {
  const sql = await readFile(migration, "utf8")

  for (const name of [
    "momi-event-routing-wakeup-v1",
    "momi-warehouse-projection-wakeup-v1",
    "momi-expired-delivery-reconcile-v1",
    "momi-event-delivery-retries-v1",
  ]) assert.match(sql, new RegExp(name))
  assert.match(sql, /toast_acquisition\.schedules where active/)
  assert.match(sql, /order-alerting-v1' and active/)
  assert.match(sql, /momi-toast-acquisition-due-v1/)
  assert.match(sql, /momi-order-alert-event-wakeup-v1/)
  assert.doesNotMatch(sql, /update toast_acquisition\.schedules\s+set active = true/)
})
