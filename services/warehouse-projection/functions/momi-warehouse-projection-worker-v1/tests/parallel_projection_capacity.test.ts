import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

const migrations = new URL(
  "../../../../../supabase/migrations/", import.meta.url,
)

const readMigration = (suffix: string) => {
  const name = readdirSync(migrations).find((candidate) =>
    candidate.endsWith(`_${suffix}.sql`))
  assert.ok(name)
  return readFileSync(new URL(name, migrations), "utf8")
}

test("reserves every dispatched delivery against configured capacity", () => {
  const schema = readMigration("parallelize_warehouse_projection")
  const scheduler = readMigration("schedule_parallel_warehouse_projection")
  assert.match(schema, /create table warehouse_projection\.worker_settings/)
  assert.match(schema, /create table warehouse_projection\.delivery_reservations/)
  assert.match(schema, /begin_reserved_delivery[\s\S]*reserved_until > now\(\)/)
  assert.match(schema, /begin_delivery[\s\S]*delete from warehouse_projection\.delivery_reservations/)
  assert.match(scheduler, /pg_advisory_xact_lock\(19482, 1\)/)
  assert.match(scheduler, /active_deliveries - reserved_deliveries/)
  assert.match(scheduler, /while woken < available_slots loop/)
  assert.match(scheduler, /reserved_until[\s\S]*interval '30 seconds'/)
  assert.match(scheduler, /status = 'queued'[\s\S]*for update skip locked/)
})

test("stale reservations cannot claim or invalidate a newer wake", () => {
  const schema = readMigration("parallelize_warehouse_projection")
  const scheduler = readMigration("schedule_parallel_warehouse_projection")
  assert.match(schema, /queue_message_id = p_message_id/)
  assert.match(schema, /capability_token = p_capability_token/)
  assert.match(scheduler, /reserved_until <= now\(\)/)
  assert.match(scheduler,
    /delivery\.capability_token = reservation\.capability_token/)
  assert.match(scheduler, /not exists \([\s\S]*delivery_reservations/)
})
