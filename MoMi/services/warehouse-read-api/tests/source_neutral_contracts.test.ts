import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const functions = [
  ["momi-warehouse-payments-get-by-id-v1", "momi.payments.get_by_id.v1"],
  ["momi-warehouse-menu-entities-get-by-id-v1",
    "momi.menu_entities.get_by_id.v1"],
  ["momi-warehouse-employees-get-by-id-v1", "momi.employees.get_by_id.v1"],
  ["momi-warehouse-schedules-get-by-id-v1", "momi.schedules.get_by_id.v1"],
  ["momi-warehouse-stock-observations-get-by-id-v1",
    "momi.stock_observations.get_latest.v1"],
] as const

test("new manifests expose exact versioned momi routes", async () => {
  for (const [slug, functionKey] of functions) {
    const manifest = JSON.parse(await readFile(new URL(
      `../functions/${slug}/function.json`, import.meta.url), "utf8"))
    assert.equal(manifest.function_key, functionKey)
    assert.equal(manifest.route_path, `/functions/v1/${slug}`)
    assert.equal(manifest.authentication_policy_key,
      "durable.read_capability.v1")
    assert.deepEqual(manifest.declared_side_effects,
      ["consumes_read_capability"])
  }
})

test("contracts require normalized documents and no source identity", async () => {
  for (const [slug] of functions) {
    const input = await readFile(new URL(
      `../functions/${slug}/contracts/input.schema.json`, import.meta.url),
    "utf8")
    const output = await readFile(new URL(
      `../functions/${slug}/contracts/output.schema.json`, import.meta.url),
    "utf8")
    assert.doesNotMatch(input + output, /toast|payload|source_id|guid/i)
    assert.match(output, /"document"/)
    assert.match(output, /"provenance"/)
    assert.match(output, /"freshness"/)
  }
})

test("shared readers stay on approved canonical views", async () => {
  const [entityReader, stockReader, consumption] = await Promise.all([
    readFile(new URL("../src/read_entity.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/read_stock.ts", import.meta.url), "utf8"),
    readFile(new URL(
      "../../../supabase/migrations/20260715064305_consume_order_read_capabilities.sql",
      import.meta.url), "utf8"),
  ])
  const source = entityReader + stockReader
  assert.match(source, /momi_api\.consume_read_capability/g)
  assert.match(source, /momi_api\.read_view_registry/g)
  assert.match(consumption, /capability\.expires_at > now\(\)/)
  assert.match(consumption, /capability\.consumed_at is null/)
  assert.doesNotMatch(source, /toast_raw|toast_hydration|source_links/i)
})

test("entity responses enforce the route's canonical entity type", async () => {
  const handler = await readFile(new URL("../src/handle_entity_request.ts",
    import.meta.url), "utf8")
  assert.match(handler, /acceptedTypes\.includes\(row\.entity_type\)/)
  assert.match(handler, /entity_type: contract\.entityType/)
})

test("menu reads accept every canonical menu entity subtype", async () => {
  const handler = await readFile(new URL(
    "../functions/momi-warehouse-menu-entities-get-by-id-v1/src/handle_request.ts",
    import.meta.url), "utf8")
  for (const entityType of ["menu", "menu_group", "menu_item",
    "modifier_group", "modifier_option"]) {
    assert.match(handler, new RegExp(`"${entityType}"`))
  }
})
