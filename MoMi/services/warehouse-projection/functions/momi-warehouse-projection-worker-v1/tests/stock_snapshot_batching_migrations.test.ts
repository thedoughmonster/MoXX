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
  const foundation = readMigration("project_batched_stock_snapshots")
  const projection = readMigration("cut_stock_snapshot_to_owner_contracts")
  const routing = readMigration("route_batched_stock_snapshots")
  assert.match(foundation, /add column snapshot_id uuid/)
  assert.match(projection,
    /project_toast_stock_observation\([\s\S]*projection_eligible/)
  assert.match(projection, /read_stock_snapshot_observations_v1/)
  assert.match(projection, /read_stock_snapshot_projection_job_v1/)
  assert.match(projection, /append_warehouse_event_v1/)
  assert.match(projection, /warehouse\.stock_snapshot\.observed/)
  assert.match(projection, /'snapshot_id', canonical_snapshot_id/)
  assert.doesNotMatch(projection,
    /toast_raw\.(api_request_attempts|resource_observations|resource_versions)|toast_acquisition\.jobs|momi_events\.events/)
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
