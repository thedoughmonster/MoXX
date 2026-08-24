import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
const ownerMigration = await readFile(new URL(
  "../supabase/migrations/20260817185245_add_momi_event_owner_contracts.sql",
  import.meta.url,
), "utf8")
const compatibilityMigration = await readFile(new URL(
  "../supabase/migrations/20260824153734_accept_legacy_staged_menu_warehouse_append_replay.sql",
  import.meta.url,
), "utf8")
const ownerStart = ownerMigration.indexOf(
  "create function momi_events.append_warehouse_event_v1",
)
const ownerEnd = ownerMigration.indexOf("comment on function", ownerStart)
const compatibilityStart = compatibilityMigration.indexOf(
  "create or replace function momi_events.append_warehouse_event_v1",
)
const compatibilityEnd = compatibilityMigration.indexOf("comment on function",
  compatibilityStart)

test("accepts only exact legacy staged-menu entity-version replay", async () => {
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
      ${ownerMigration.slice(ownerStart, ownerEnd)}
      ${compatibilityMigration.slice(compatibilityStart, compatibilityEnd)}
    `)
    const entityTypes = [
      "menu", "menu_group", "menu_item", "modifier_group", "modifier_option",
    ]
    const firstCorrelation = "00000000-0000-0000-0000-000000000401"
    const laterCorrelation = "00000000-0000-0000-0000-000000000402"
    let replaySql = ""
    let firstEntity = ""
    let firstReference = ""
    for (const [index, entityType] of entityTypes.entries()) {
      const suffix = String(410 + index).padStart(12, "0")
      const version = `00000000-0000-0000-0000-${suffix}`
      const entity = `10000000-0000-0000-0000-${suffix}`
      const sourceReference = `{"id":"${version}"}`
      const legacy = await database.query<{ event_id: string }>(`insert into
        momi_events.events (event_name, occurred_at, schema_version,
          idempotency_key, entity_type, entity_id, source_system,
          source_resource_type, source_id, source_reference, correlation_id)
        values ('warehouse.menu_entity.observed', '2026-07-01', 2,
          'warehouse:entity-version:${version}', '${entityType}', '${entity}',
          'toast', '${entityType}', 'source-${index}', '${sourceReference}',
          '${firstCorrelation}') returning event_id::text`)
      const candidateReplay = `select event_id::text from
        momi_events.append_warehouse_event_v1(
          'warehouse.entity.observed', 2,
          'warehouse:entity-version:${version}', '${entityType}', '${entity}',
          '2026-08-02', 'toast', '${entityType}', 'source-${index}',
          '${sourceReference}', '${laterCorrelation}')`
      const compatible = await database.query<{ event_id: string }>(
        candidateReplay,
      )
      assert.equal(compatible.rows[0].event_id, legacy.rows[0].event_id)
      const retained = await database.query<{
        occurred_at: string, correlation_id: string
      }>(`select occurred_at::text, correlation_id::text
        from momi_events.events where event_id = '${legacy.rows[0].event_id}'`)
      assert.match(retained.rows[0].occurred_at, /^2026-07-01/)
      assert.equal(retained.rows[0].correlation_id, firstCorrelation)
      if (index === 0) {
        replaySql = candidateReplay
        firstEntity = entity
        firstReference = sourceReference
      }
    }
    const divergentReplay = [
      replaySql.replace("'warehouse.entity.observed', 2,",
        "'warehouse.entity.observed', 1,"),
      replaySql.replace("'menu'", "'menu_group'"),
      replaySql.replace(firstEntity,
        "20000000-0000-0000-0000-000000000410"),
      replaySql.replace("'2026-08-02', 'toast'", "'2026-08-02', 'square'"),
      replaySql.replace("'toast', 'menu', 'source-0'", "'toast', 'menu_item', 'source-0'"),
      replaySql.replace("'source-0'", "'source-other'"),
      replaySql.replace(firstReference, '{"id":"different"}'),
    ]
    for (const query of divergentReplay) {
      await assert.rejects(database.query(query),
        /warehouse event append replay conflicts/)
    }
    for (const [index, entityType] of ["ingredient", "menu_entity"].entries()) {
      const suffix = String(420 + index).padStart(12, "0")
      const version = `00000000-0000-0000-0000-${suffix}`
      const entity = `10000000-0000-0000-0000-${suffix}`
      await database.exec(`insert into momi_events.events values (
        extensions.gen_random_uuid(), 'warehouse.menu_entity.observed',
        '2026-07-01', 2, 'warehouse:entity-version:${version}',
        '${entityType}', '${entity}', 'toast', '${entityType}', 'source-x',
        '{"id":"${version}"}', '${firstCorrelation}')`)
      await assert.rejects(database.query(`select * from
        momi_events.append_warehouse_event_v1(
          'warehouse.entity.observed', 2,
          'warehouse:entity-version:${version}', '${entityType}',
          '${entity}', '2026-08-02', 'toast', '${entityType}', 'source-x',
          '{"id":"${version}"}', '${laterCorrelation}')`),
      /warehouse event append replay conflicts/)
    }
  } finally {
    await database.close()
  }
})
