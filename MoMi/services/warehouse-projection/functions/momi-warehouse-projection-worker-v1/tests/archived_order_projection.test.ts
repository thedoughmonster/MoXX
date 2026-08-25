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

test("central order archives use normalized order presentation", () => {
  const source = readMigration("extend_canonical_order_sources")
  const route = readMigration("route_canonical_menu_stock_projection")
  const projector = readMigration("classify_canonical_order_events")
  const generic = readMigration("normalize_generic_resource_projection")
  const lookup = readMigration("index_archived_order_source_version_lookup")
  assert.match(source, /toast_raw\.resource_versions/)
  assert.match(source, /toast_raw\.webhook_events/)
  assert.match(source, /event\.subscription_key = 'orders'/)
  assert.match(source, /source\.resource_type = 'order'/)
  assert.match(source, /'archive:' \|\| source\.resource_version_id/)
  assert.match(route, /source_version\.resource_type = 'order'/)
  assert.match(route, /warehouse_projection\.project_toast_order/)
  assert.match(generic,
    /resource_type = 'order'[\s\S]*project_toast_archived_order/)
  assert.match(projector, /source_order\.order_presentation/)
  assert.match(projector, /'presentation', source_order\.order_presentation/)
  assert.match(projector, /'source_id', source_order\.order_id/)
  assert.match(lookup,
    /\('archive:'::text \|\| resource_version_id::text\)/)
  assert.match(lookup,
    /source_system = 'toast' and resource_type = 'order'/)
})

test("backfilled orders cannot fan out to operational alerting", () => {
  const projector = readMigration("classify_canonical_order_events")
  const subscription = readMigration("restrict_operational_order_alerts")
  const bridge = readMigration("create_order_alert_event_bridge")
  assert.match(projector, /acquisition_mode = 'backfill'[\s\S]*warehouse\.order\.archived/)
  assert.match(projector, /warehouse\.order\.reconciled/)
  assert.match(projector, /p_source_version_id like 'webhook:%'[\s\S]*warehouse\.order\.observed/)
  assert.match(subscription, /event_pattern = 'warehouse\.order\.observed'/)
  assert.doesNotMatch(subscription, /warehouse\.order\.%/)
  assert.match(bridge, /event_name = 'warehouse\.order\.observed'/)
  const operationalPattern = "warehouse.order.observed"
  assert.equal("warehouse.order.archived" === operationalPattern, false)
  assert.equal("warehouse.order.reconciled" === operationalPattern, false)
  assert.equal("warehouse.order.observed" === operationalPattern, true)
})
