import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

const migrations = new URL(
  "../../../../../supabase/migrations/",
  import.meta.url,
)

const readMigration = (suffix: string) => {
  const name = readdirSync(migrations).find((entry) =>
    entry.endsWith(`_${suffix}.sql`)
  )
  assert.ok(name, `missing migration ${suffix}`)
  return readFileSync(new URL(name, migrations), "utf8")
}

test("stock polling emits one source event per archived response job", () => {
  const resourceEvents = readMigration("batch_stock_snapshot_events")
  const snapshotEvents = readMigration("route_batched_stock_snapshots")
  assert.match(resourceEvents,
    /resource_type = 'stock_state'[\s\S]*return new/)
  assert.match(snapshotEvents,
    /source\.toast\.resource\.stock_snapshot\.completed/)
  assert.match(snapshotEvents, /'toast:stock-job:' \|\| new\.job_id/)
  assert.doesNotMatch(snapshotEvents, /new\.mode <> 'snapshot'/)
  assert.doesNotMatch(snapshotEvents, /response_json[^;]*source_reference/)
})

test("one batch projection groups item observations and emits one DM event", () => {
  const projection = readMigration("project_batched_stock_snapshots")
  const routing = readMigration("route_batched_stock_snapshots")
  assert.match(projection, /add column snapshot_id uuid/)
  assert.match(projection,
    /project_toast_stock_observation\([\s\S]*source_attempt\.job_id = p_job_id/)
  assert.match(projection, /warehouse\.stock_snapshot\.observed/)
  assert.match(projection, /'snapshot_id', canonical_snapshot_id/)
  assert.match(routing, /project_toast_stock_snapshot/)
})

test("backlog recovery serializes durable wakeups", () => {
  const routing = readMigration("queue_event_routing_trigger_adapter")
  const projection = readMigration("queue_projection_trigger_adapter")
  for (const migration of [routing, projection]) {
    assert.match(migration, /schedule := '3 seconds'/)
    assert.match(migration, /limit 1 for update skip locked/)
    assert.match(migration, /active := true/)
  }
  assert.match(routing, /tg_op = 'INSERT'/)
  assert.match(routing, /new\.next_attempt_at > now\(\)/)
  assert.match(projection, /old\.status is distinct from new\.status/)
  assert.match(projection,
    /old\.queue_message_id is distinct from new\.queue_message_id/)
  assert.match(projection, /set capability_token = gen_random_uuid\(\)/)
})
