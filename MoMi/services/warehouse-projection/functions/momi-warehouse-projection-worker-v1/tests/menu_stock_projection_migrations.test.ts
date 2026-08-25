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

test("flattens a Menus V2 document into DM-owned entities", () => {
  const staging = readMigration("create_menu_projection_staging") +
    readMigration("stage_toast_menu_references") +
    readMigration("create_menu_projection_relationships")
  const canonical = readMigration("create_canonical_menu_documents") +
    readMigration("project_canonical_menu_entities") +
    readMigration("project_toast_menu_documents")
  for (const kind of [
    "menu", "menu_group", "menu_item", "modifier_group", "modifier_option",
  ]) assert.match(staging, new RegExp(`'${kind}'`))
  assert.match(staging, /with recursive group_tree/)
  assert.match(staging, /modifier_item_reference/)
  assert.match(staging,
    /staged_menu_relationships[\s\S]*language plpgsql/)
  assert.match(canonical, /momi_warehouse\.menu_universe_items/)
  assert.match(canonical, /warehouse_projection\.record_entity_version/)
  assert.match(canonical, /'entity_type', p_entity_kind/)
  assert.match(staging, /'menu_item_ids'/)
  assert.doesNotMatch(canonical, /return[\s\S]*\|\|\s*p_source[;) ]/)
  assert.match(canonical, /'table', 'resource_observations'/)
})

test("daily stock fills absences while live projection stays exception-only", () => {
  const explicit = readMigration("project_toast_stock_observations")
  const daily = readMigration("project_daily_stock_snapshots")
  const event = readMigration("emit_daily_stock_snapshot_events")
  assert.match(explicit, /itemGuidValidity/)
  assert.match(explicit, /'observation_kind', 'explicit'/)
  assert.doesNotMatch(explicit, /absent_from_complete_exception_snapshot/)
  assert.match(daily, /job\.mode <> 'snapshot'/)
  assert.match(daily, /jsonb_typeof\(response_json\) = 'array'/)
  assert.match(daily, /momi_warehouse\.menu_universe_items/)
  assert.match(daily, /'IN_STOCK'/)
  assert.match(daily, /absent_from_complete_exception_snapshot/)
  assert.match(event, /source\.toast\.resource\.stock_snapshot\.completed/)
})

test("source versions, observations, and stock rows replay idempotently", () => {
  const universe = readMigration("create_canonical_menu_universe")
  const entities = readMigration("project_canonical_menu_entities")
  const versions = readMigration("harden_entity_version_idempotency")
  const stock = readMigration("project_toast_stock_observations") +
    readMigration("project_daily_stock_snapshots")
  assert.match(universe, /source_observation_key text not null unique/)
  assert.match(universe, /menu_universe_source_unique unique/)
  assert.match(entities, /on conflict \(source_observation_key\) do nothing/)
  assert.match(stock, /on conflict \(source_observation_key\) do nothing/g)
  assert.match(versions,
    /entity_id, source_system, source_resource_type, source_id/)
  assert.match(versions,
    /greatest\(\s*existing\.source_observed_at, excluded\.source_observed_at/)
  assert.match(versions, /source_observation_version_conflict/)
})

test("one strict identity map unifies stock, menu, and location sources", () => {
  const mapping = readMigration("harden_canonical_entity_identity")
  const strict = readMigration("enforce_canonical_source_identity")
  const repair = readMigration("merge_legacy_projection_identities")
  const generic = readMigration("normalize_generic_resource_projection")
  const stock = readMigration("project_toast_stock_observations")
  assert.match(mapping, /when 'restaurant' then 'location'/)
  assert.match(mapping, /when 'stock_state' then 'menu_item'/)
  assert.match(mapping, /when 'catalog_item' then 'menu_item'/)
  assert.match(mapping, /'menu', 'menu_group', 'menu_item'/)
  assert.match(strict, /canonical_entity_type_mismatch/)
  assert.match(strict, /source_entity_type_conflict/)
  assert.match(strict, /resolved_status <> 'active'/)
  assert.match(repair, /restaurant\.entity_id (?:as )?duplicate_id/)
  assert.match(repair, /stock\.entity_id, item\.entity_id/)
  assert.match(generic,
    /resource_type in \('restaurant', 'location'\)[\s\S]*entity_id := location_id/)
  assert.match(stock, /entity\.entity_type = 'menu_item'/)
})

test("legacy identity merges preserve canonical version history", () => {
  const repair = readMigration("merge_legacy_projection_identities")
  const observations = repair.indexOf("update momi_warehouse.version_observations")
  const remove = repair.indexOf("delete from momi_warehouse.entity_versions")
  const reparent = repair.lastIndexOf("update momi_warehouse.entity_versions")
  const merged = repair.indexOf("set lifecycle_status = 'merged'")
  assert.ok(observations >= 0 && observations < remove)
  assert.ok(remove < reparent && reparent < merged)
  assert.match(repair, /event\.source_reference @>/)
  assert.match(repair, /not plan\.event_referenced/g)
  assert.match(repair, /jsonb_set\(version\.canonical_document, '\{id\}'/)
  assert.match(repair, /digest\(target_document::text, 'sha256'\)/)
  assert.match(repair, /'identity_merge_versions'/)
})

test("Toast and Square fixture identifiers share one consumer item ID", () => {
  const fixture = JSON.parse(readFileSync(new URL(
    "fixtures/cross_source_item.fixture.json", import.meta.url,
  ), "utf8"))
  const linker = readMigration("enforce_canonical_source_identity")
  const mapping = readMigration("harden_canonical_entity_identity")
  assert.deepEqual(new Set(fixture.source_links.map(
    (link: { entity_id: string }) => link.entity_id,
  )), new Set([fixture.entity_id]))
  assert.equal(fixture.consumer_observation.item_entity_id, fixture.entity_id)
  assert.match(linker, /p_source_system/)
  assert.match(linker, /p_entity_id/)
  assert.doesNotMatch(linker, /values \(\s*'toast'/)
  assert.match(mapping, /when 'catalog_item' then 'menu_item'/)
})
