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

test("canonical resource v2 maps Toast fields into DM vocabulary", () => {
  const sql = readMigration("create_canonical_resource_document_v2")
  const menu = readMigration("create_canonical_menu_documents")
  for (const [canonical, source] of [
    ["status", "paymentStatus"],
    ["name", "title"],
    ["starts_at", "inDate"],
    ["ends_at", "outDate"],
    ["online_orderable", "orderableOnline"],
    ["behavior", "behavior"],
    ["curbside", "curbside"],
  ]) {
    const mapping = sql.slice(sql.indexOf(`'${canonical}'`),
      sql.indexOf(`'${canonical}'`) + 240)
    assert.ok(mapping.startsWith(`'${canonical}'`),
      `missing canonical field ${canonical}`)
    assert.match(mapping, new RegExp(source))
  }
  assert.match(sql, /canonical_menu_document\(/)
  assert.match(menu, /create function warehouse_projection\.canonical_menu_document/)
  for (const field of ["sku", "plu", "sales_channels", "calories"]) {
    assert.match(menu, new RegExp(`'${field}'`))
  }
})

test("generic projection uses the canonical resource v2 builder", () => {
  const sql = readMigration("use_canonical_resource_document_v2")
  assert.match(sql,
    /canonical_resource_document_v2\([\s\S]*source_version\.payload/)
  assert.match(sql, /projection_contract := 'canonical-resource-v2'/)
})

test("published menu entities win over reference-only copies", () => {
  const sql = readMigration("prefer_published_menu_entities")
  const ordering = sql.slice(sql.indexOf("order by version.entity_id"))
  assert.match(sql, /create or replace view momi_api\.warehouse_entities_by_id_v1/)
  assert.match(sql, /distinct on \(version\.entity_id\)/)
  assert.match(ordering,
    /entity\.entity_type in \([\s\S]*'menu_item'[\s\S]*'modifier_option'/)
  assert.match(ordering,
    /version\.provenance ->> 'resource_type' = 'menu'[\s\S]*then 0 else 1 end/)
  assert.ok(ordering.indexOf("version.provenance") <
    ordering.indexOf("version.source_observed_at desc"))
})

test("canonical replay is one set-based insert-select", () => {
  const sql = readMigration("replay_canonical_resource_projection_v2")
  assert.match(sql, /insert into[\s\S]*select/i)
  assert.doesNotMatch(sql, /\b(?:for|while)\b[\s\S]*\bloop\b/i)
})

test("database batches commit each delivery lifecycle independently", () => {
  const sql = readMigration("process_warehouse_projection_batches")
  assert.match(sql, /create procedure warehouse_projection\.process_delivery_batch/)
  assert.match(sql, /processor_mode in \('edge', 'database'\)/)
  assert.match(sql, /enforce_edge_reservation_mode/)
  assert.match(sql, /for update skip locked/i)
  assert.match(sql, /momi_events\.begin_delivery/)
  assert.ok((sql.match(/commit and chain/gi) ?? []).length >= 2)
  assert.match(sql, /warehouse_projection\.project_and_ack_delivery/)
  assert.match(sql, /exception[\s\S]*momi_events\.fail_delivery/i)
})

test("activation fences Edge and starts the conservative SQL cron", () => {
  const sql = readMigration("activate_database_warehouse_projection_batches")
  assert.match(sql, /drop trigger if exists wake_warehouse_projection_worker/)
  assert.match(sql, /function_trigger_registry[\s\S]*set active = false/)
  assert.match(sql, /momi-warehouse-projection-wakeup-v1/)
  assert.match(sql, /active\s*:=\s*false|cron\.unschedule/)
  assert.match(sql, /processor_mode = 'database'/)
  assert.match(sql, /delete from warehouse_projection\.delivery_reservations/)
  assert.match(sql, /cron\.(?:schedule|alter_job)[\s\S]*'3 seconds'/)
  assert.match(sql, /call warehouse_projection\.process_delivery_batch\(6, 60\)/)
  assert.match(sql, /momi-event-delivery-retries-v1/)
  assert.match(sql, /momi-expired-delivery-reconcile-v1/)
  assert.doesNotMatch(sql, /net\.http_post/)
})
