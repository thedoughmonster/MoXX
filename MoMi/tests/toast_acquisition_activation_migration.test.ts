import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../supabase/migrations/20260715094740_activate_toast_acquisition_schedules.sql",
  import.meta.url,
)

test("activates only schedules backed by enabled source configuration", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /join toast_acquisition\.operations.*using \(operation_key\)/s)
  assert.match(sql, /join toast_acquisition\.restaurants/s)
  assert.match(sql, /operation\.is_enabled and restaurant\.is_enabled/g)
  assert.match(sql, /set next_due_at = planned\.first_due_at, active = true/)
  assert.match(sql, /Eligible acquisition schedules remain inactive/)
})

test("makes intervals due now and computes future local calendar runs", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /when 'interval' then now\(\)/)
  assert.match(sql, /now\(\) at time zone schedule\.timezone/)
  assert.match(sql, /when 'daily' then case when daily_due > now\(\)/)
  assert.match(sql, /date_trunc\('month', local_now\)/)
  assert.match(sql, /schedule_kind <> 'interval' and next_due_at <= now\(\)/)
  assert.doesNotMatch(sql, /update toast_acquisition\.schedules\s+set active = true/s)
})

test("enables only acquisition due cron and preserves alert isolation", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /toast\.data\.acquisition\.v1/)
  assert.match(sql, /toast\.data\.acquisition\.http\.v1/)
  assert.match(sql, /cron\.alter_job\(job_id := jobid, active := true\)/)
  assert.match(sql, /momi-toast-acquisition-due-v1/g)
  assert.match(sql, /order-alerting-v1/)
  assert.match(sql, /momi-order-alert-event-wakeup-v1/)
  assert.doesNotMatch(sql, /set active = true[\s\S]*order-alerting-v1/)
})
