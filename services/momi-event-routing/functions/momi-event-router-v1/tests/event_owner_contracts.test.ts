import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = await readFile(new URL(
  "../../../../../supabase/migrations/20260817185245_add_momi_event_owner_contracts.sql",
  import.meta.url,
), "utf8")
const manifest = JSON.parse(await readFile(new URL(
  "../../../service.json",
  import.meta.url,
), "utf8"))
const decision = await readFile(new URL(
  "../../../../../docs/decisions/0030-runtime-event-owner-contract-foundation.md",
  import.meta.url,
), "utf8")

test("manifest publishes the exact event-owner contracts", () => {
  assert.equal(manifest.owned_dataset.db_role, "svc_momi_event_routing")
  for (const contract of [
    "momi.events.delivery_reference.v1",
    "momi.events.delivery_witness.v1",
    "momi.events.warehouse_delivery_reservation.v1",
    "momi.events.warehouse_append.v1",
  ]) assert(manifest.contracts.provides.includes(contract))
  assert(manifest.contracts.consumes.some(
    (entry: { service: string; contract: string }) =>
      entry.service === "runtime-registry" &&
      entry.contract === "momi.runtime.active_trigger_resolution.v1",
  ))
  assert.equal(manifest.owned_dataset.public_routine_commands.length, 14)
  assert.match(decision, /Status: accepted/)
  assert.match(decision, /momi\.runtime\.active_trigger_resolution\.v1/)
  assert.match(decision, /momi\.events\.warehouse_append\.v1/)
})

test("reference contracts are fixed and reference-only", () => {
  assert.match(migration, /read_order_alert_delivery_reference_v1\(/)
  assert.match(migration, /read_warehouse_projection_delivery_reference_v1\(/)
  assert.match(migration, /delivery\.subscription_key = 'order-alerting-v1'/)
  assert.match(migration, /event\.event_name = 'warehouse\.order\.observed'/)
  assert.match(migration, /delivery\.subscription_key = 'warehouse-projection-toast-v1'/)
  assert.match(migration, /event\.source_system = 'toast'/)
  assert.match(migration, /event\.event_name like 'source\.toast\.%'/)
  assert.doesNotMatch(migration, /returns table \([^;]*payload/is)
  assert.doesNotMatch(migration, /returns table \([^;]*recorded_at/is)
  assert.doesNotMatch(migration, /returns table \([^;]*idempotency_key/is)
})

test("witnesses and wake authorization fence exact capabilities", () => {
  assert.match(migration, /p_minimum_remaining_seconds not between 0 and 120/g)
  assert.match(migration, /for update of delivery/g)
  assert.match(migration, /authorize_order_alert_delivery_wake_v1\(/)
  assert.match(migration, /delivery\.status = 'queued'/)
  assert.match(migration, /subscription\.consumer_service = 'order-alerting'/)
  assert.match(migration, /subscription\.event_pattern = 'warehouse\.order\.observed'/)
  assert.match(migration, /subscription\.active/)
})

test("warehouse reservations are event-owned and bounded", () => {
  assert.match(migration, /create table momi_events\.warehouse_delivery_reservations/)
  assert.match(migration, /p_dispatch_mode not in \('http', 'internal'\)/)
  assert.match(migration, /p_max_inflight not between 1 and 32/)
  assert.match(migration, /p_reservation_seconds not between 5 and 120/)
  assert.match(migration, /for update skip locked/)
  assert.match(migration, /set capability_token = v_token/)
  assert.match(migration, /case when p_dispatch_mode = 'http'/)
  assert.match(migration, /else v_target\.capability_token/)
  assert.match(migration, /delete from momi_events\.warehouse_delivery_reservations/)
  assert.ok(
    migration.lastIndexOf("insert into momi_events.warehouse_delivery_reservations") <
      migration.indexOf("set capability_token = v_token"),
  )
  assert.match(migration, /claim_warehouse_projection_delivery_v1\(\)/)
  assert.match(migration, /reserve_warehouse_projection_delivery_v1\(/)
  assert.match(migration,
    /begin_reserved_warehouse_projection_delivery_v1\(/)
  assert.match(migration,
    /reservation\.dispatch_mode in \('http', 'internal'\)/)
  assert.match(migration, /reservation\.reserved_until > pg_catalog\.now\(\)/)
})

test("warehouse append has bounded identity and replay", () => {
  assert.match(migration, /append_warehouse_event_v1\(/)
  assert.match(migration, /p_event_name !~ '\^warehouse\\\./)
  assert.match(migration, /p_schema_version not in \(1, 2\)/)
  assert.match(migration, /p_entity_id is null/)
  assert.match(migration, /jsonb_typeof\(p_source_reference\) <> 'object'/)
  assert.match(migration, /on conflict \(idempotency_key\) do nothing/)
  assert.match(migration, /v_existing\.entity_id is distinct from p_entity_id/)
  assert.match(migration, /v_entity_version_replay/)
  assert.match(migration, /'warehouse\.' \|\| p_entity_type \|\| '\.observed'/)
  assert.match(migration, /warehouse event append replay conflicts/)
  assert.match(migration, /errcode = '23505'/)
})

test("lifecycle and new contracts use bounded definer grants", () => {
  assert.doesNotMatch(migration, /grant usage on schema/i)
  for (const routine of ["begin_delivery", "ack_delivery", "fail_delivery"]) {
    assert.match(migration, new RegExp(
      `create or replace function momi_events\\.${routine}\\([\\s\\S]*?security definer`,
    ))
  }
  assert.match(migration, /lease_expires_at = pg_catalog\.now\(\) \+ interval '120 seconds'/)
  assert.match(migration, /if v_attempts >= 12 then/)
  assert.match(migration, /pgmq\.delete\(v_queue_name, p_message_id\)/)
  assert.match(migration, /from public, anon, authenticated, service_role/g)
  assert.match(migration, /to svc_order_alerting, svc_warehouse_projection/)
  assert.match(migration, /to svc_order_alerting, svc_warehouse_read_api/)
  assert.match(migration, /to svc_warehouse_projection/)
})
