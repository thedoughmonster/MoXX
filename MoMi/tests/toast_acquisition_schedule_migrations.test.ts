import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const scheduleName = "20260714175717_configure_toast_acquisition_live_schedules.sql"
const discoveryName = "20260714185415_automate_toast_backfill_and_group_discovery.sql"
const bootstrapName = "20260715085415_bootstrap_toast_ordering_schedule_capture.sql"

test("gives each payment date selector a distinct schedule key", async () => {
  const sql = await readFile(new URL(scheduleName, migrations), "utf8")

  assert.match(sql, /':daily'\s*\|\| case when schedule_variant is null/)
  for (const selector of [
    "paidBusinessDate", "refundBusinessDate", "voidBusinessDate",
  ]) {
    assert.match(sql, new RegExp(
      `\\('toast\\.payments\\.list\\.v1', '${selector}'.*` +
      `"date_selector":"${selector}"`,
    ))
  }
})

test("polls menu metadata every thirty minutes without an ordering window", async () => {
  const sql = await readFile(new URL(scheduleName, migrations), "utf8")

  assert.match(sql, /\('toast\.menus\.metadata\.v1', 1800, null, 'Published menu timestamp check'\)/)
  assert.match(sql, /window_key, reason, now\(\), p_active/)
})

test("stages every bootstrap schedule inactive", async () => {
  const sql = await readFile(new URL(scheduleName, migrations), "utf8")

  assert.match(sql, /p_active boolean default false/)
  assert.match(sql, /seed_restaurant_schedules\(\s*source_key, restaurant_guid, false\)/)
  assert.equal(sql.match(/now\(\), p_active/g)?.length, 5)
  assert.doesNotMatch(sql, /now\(\), true/)
  assert.doesNotMatch(sql, /06:30|08:00|manual_online_ordering_bootstrap/)
})

test("registers recurring discovery without an immediate job", async () => {
  const sql = await readFile(new URL(discoveryName, migrations), "utf8")

  assert.match(sql, /insert into toast_acquisition\.schedules/)
  assert.match(sql, /'snapshot', 'daily', time '20:23'/)
  assert.match(sql, /now\(\), coalesce\(detail_schedule\.active, false\)/)
  assert.match(sql, /on conflict \(schedule_key\) do update/)
  assert.doesNotMatch(sql, /insert into toast_acquisition\.jobs/)
})

test("the reusable seed includes every required restaurant cadence", async () => {
  const sql = await readFile(new URL(scheduleName, migrations), "utf8")

  for (const marker of [
    "Live stock observation", "Daily restaurant detail and first business date",
    "After-close order reconciliation", "Monthly complete shift rescan",
    "Daily full configuration sweep",
  ]) assert.match(sql, new RegExp(marker))
  assert.equal(sql.match(/on conflict \(schedule_key\) do nothing/g)?.length, 5)
})

test("bootstraps the real ordering window without enabling recurring polls", async () => {
  const sql = await readFile(new URL(bootstrapName, migrations), "utf8")

  assert.match(sql, /function_key = 'toast\.data\.acquisition\.v1'/)
  assert.match(sql, /trigger_key = 'toast\.data\.acquisition\.http\.v1'/)
  assert.match(sql, /cron\.alter_job\(job_id := jobid, active := true\)/)
  assert.match(sql, /jobname = 'momi-toast-acquisition-wakeup-v1'/)
  assert.match(sql, /insert into toast_acquisition\.jobs/)
  assert.match(sql, /'toast\.ordering_schedule\.snapshot\.v1'/)
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/)
  assert.doesNotMatch(sql, /update toast_acquisition\.schedules/)
  assert.doesNotMatch(sql, /momi-toast-acquisition-due-v1/)
  for (const forbidden of [
    "momi.events.route.v1",
    "momi.warehouse_projection.toast.consume.v1",
    "momi.orders.get_by_id.v1",
  ]) assert.doesNotMatch(sql, new RegExp(forbidden.replaceAll(".", "\\.")))
})
