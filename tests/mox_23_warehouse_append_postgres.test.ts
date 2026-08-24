import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

const migration = await readFile(new URL(
  "../supabase/migrations/20260817185245_add_momi_event_owner_contracts.sql",
  import.meta.url,
), "utf8")
const appendStart = migration.indexOf(
  "create function momi_events.append_warehouse_event_v1",
)
const appendEnd = migration.indexOf("comment on function", appendStart)

test("preserves entity-version replay and pre-cutover identity", async () => {
  const database = new PGlite({ extensions: { pgcrypto } })
  try {
    await database.exec(`
      create schema extensions;
      create extension pgcrypto with schema extensions;
      create schema momi_events;
      create table momi_events.events (
        event_id uuid primary key default extensions.gen_random_uuid(),
        event_name text not null, occurred_at timestamptz not null,
        schema_version integer not null, idempotency_key text not null unique,
        entity_type text, entity_id uuid, source_system text,
        source_resource_type text, source_id text, source_reference jsonb,
        correlation_id uuid not null
      );
      ${migration.slice(appendStart, appendEnd)}
    `)
    const version = "00000000-0000-0000-0000-000000000201"
    const entity = "00000000-0000-0000-0000-000000000202"
    const firstCorrelation = "00000000-0000-0000-0000-000000000203"
    const laterCorrelation = "00000000-0000-0000-0000-000000000204"
    const append = (occurredAt: string, correlation: string) => `select
      event_id::text from momi_events.append_warehouse_event_v1(
        'warehouse.entity.observed', 2, 'warehouse:entity-version:${version}',
        'menu_item', '${entity}', '${occurredAt}', 'toast', 'menu_item',
        'source-1', '{"id":"${version}"}', '${correlation}')`
    const first = await database.query<{ event_id: string }>(append(
      "2026-08-01T00:00:00Z", firstCorrelation,
    ))
    const repeated = await database.query<{ event_id: string }>(append(
      "2026-08-02T00:00:00Z", laterCorrelation,
    ))
    assert.equal(repeated.rows[0].event_id, first.rows[0].event_id)
    const retained = await database.query<{
      occurred_at: string, correlation_id: string
    }>(`select occurred_at::text, correlation_id::text
      from momi_events.events where event_id = '${first.rows[0].event_id}'`)
    assert.match(retained.rows[0].occurred_at, /^2026-08-01/)
    assert.equal(retained.rows[0].correlation_id, firstCorrelation)

    const legacyEvent = "00000000-0000-0000-0000-000000000205"
    const legacyVersion = "00000000-0000-0000-0000-000000000206"
    await database.exec(`insert into momi_events.events values (
      '${legacyEvent}', 'warehouse.menu_item.observed', '2026-07-01', 2,
      'warehouse:entity-version:${legacyVersion}', 'menu_item', '${entity}',
      'toast', 'menu_item', 'source-2', '{"id":"${legacyVersion}"}',
      '${firstCorrelation}')`)
    const compatible = await database.query<{ event_id: string }>(`select
      event_id::text from momi_events.append_warehouse_event_v1(
        'warehouse.entity.observed', 2,
        'warehouse:entity-version:${legacyVersion}', 'menu_item', '${entity}',
        '2026-08-02', 'toast', 'menu_item', 'source-2',
        '{"id":"${legacyVersion}"}', '${laterCorrelation}')`)
    assert.equal(compatible.rows[0].event_id, legacyEvent)
    await assert.rejects(database.query(`select * from
      momi_events.append_warehouse_event_v1(
        'warehouse.entity.observed', 2,
        'warehouse:entity-version:${legacyVersion}', 'menu_item', '${entity}',
        '2026-08-02', 'toast', 'menu_item', 'source-2',
        '{"id":"different"}', '${laterCorrelation}')`),
    /warehouse event append replay conflicts/)
    await database.query(`select * from momi_events.append_warehouse_event_v1(
      'warehouse.order.observed', 2, 'warehouse:order:${version}', 'order',
      '${entity}', '2026-08-01', 'toast', 'order', 'source-3',
      '{"id":"${version}"}', '${firstCorrelation}')`)
    await assert.rejects(database.query(`select * from
      momi_events.append_warehouse_event_v1(
        'warehouse.order.observed', 2, 'warehouse:order:${version}', 'order',
        '${entity}', '2026-08-02', 'toast', 'order', 'source-3',
        '{"id":"${version}"}', '${laterCorrelation}')`),
    /warehouse event append replay conflicts/)
  } finally {
    await database.close()
  }
})
