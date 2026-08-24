import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const owner = await readFile(new URL(
  "../supabase/migrations/20260817185245_add_momi_event_owner_contracts.sql",
  import.meta.url,
), "utf8")
const cutover = await readFile(new URL(
  "../supabase/migrations/20260817185934_route_warehouse_projection_trigger_adapters_through_owner_contracts.sql",
  import.meta.url,
), "utf8")
const referenceStart = owner.indexOf(
  "create function momi_events.read_warehouse_projection_delivery_reference_v1",
)
const referenceEnd = owner.indexOf(
  "create function momi_events.acquire_order_alert_delivery_witness_v1",
  referenceStart,
)
const projectorStart = cutover.indexOf(
  "create or replace function warehouse_projection.project_and_ack_delivery",
)
const projectorEnd = cutover.indexOf(
  "create or replace function warehouse_projection.reserve_internal_delivery",
  projectorStart,
)
const reservationStart = cutover.indexOf(
  "create or replace function warehouse_projection.reserve_internal_delivery",
)
const reservationCutover = cutover.slice(reservationStart)

test("preserves source and processor fences", async () => {
  assert.match(reservationCutover,
    /reserve_internal_delivery[\s\S]*processor_mode = 'edge'/)
  assert.match(reservationCutover,
    /wake_next_delivery[\s\S]*processor_mode = 'edge'/)
  assert.match(reservationCutover,
    /if parallel_limit is null then return false/)
  const database = new PGlite()
  try {
    await database.exec(`
      create schema momi_events;
      create schema warehouse_projection;
      create table momi_events.events (
        event_id uuid primary key, event_name text, entity_type text,
        entity_id uuid, occurred_at timestamptz, schema_version integer,
        source_system text, source_resource_type text, source_id text,
        source_reference jsonb, correlation_id uuid
      );
      create table momi_events.deliveries (
        subscription_key text, event_id uuid, queue_message_id bigint,
        capability_token uuid, status text, lease_expires_at timestamptz
      );
      create table warehouse_projection.projection_calls (event_id uuid);
      create function momi_events.acquire_warehouse_projection_delivery_witness_v1(
        uuid, bigint, uuid, integer
      ) returns table (lease_expires_at timestamptz) language sql as
      $$ select now() + interval '1 minute' $$;
      create function momi_events.ack_delivery(text, uuid, bigint, uuid)
      returns boolean language sql as $$ select true $$;
      create function warehouse_projection.project_toast_event(p_event_id uuid)
      returns text language plpgsql as $$ begin
        insert into warehouse_projection.projection_calls values (p_event_id);
        return 'projected';
      end $$;
      ${owner.slice(referenceStart, referenceEnd)}
      ${cutover.slice(projectorStart, projectorEnd)}
    `)
    const eventId = "00000000-0000-0000-0000-000000000101"
    const entityId = "00000000-0000-0000-0000-000000000102"
    const token = "00000000-0000-0000-0000-000000000103"
    const correlation = "00000000-0000-0000-0000-000000000104"
    await database.exec(`
      insert into momi_events.events values (
        '${eventId}', 'source.toast.resource.menu.observed', 'menu',
        '${entityId}', now(), 1, 'other', 'menu', 'source-1', '{}',
        '${correlation}'
      );
      insert into momi_events.deliveries values (
        'warehouse-projection-toast-v1', '${eventId}', 7, '${token}',
        'running', now() + interval '1 minute'
      );
    `)
    await assert.rejects(database.query(`select
      warehouse_projection.project_and_ack_delivery(
        '${eventId}', 7, '${token}')`), /source_event_mismatch/)
    const rejected = await database.query<{ count: number }>(`select
      count(*)::integer as count from warehouse_projection.projection_calls`)
    assert.equal(rejected.rows[0].count, 0)
    await database.exec(`update momi_events.events set source_system = 'toast'
      where event_id = '${eventId}'`)
    await database.query(`select warehouse_projection.project_and_ack_delivery(
      '${eventId}', 7, '${token}')`)
    const accepted = await database.query<{ count: number }>(`select
      count(*)::integer as count from warehouse_projection.projection_calls`)
    assert.equal(accepted.rows[0].count, 1)
  } finally {
    await database.close()
  }
})
