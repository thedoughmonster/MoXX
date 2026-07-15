import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)

test("registers collection response shapes and the scheduled detail exception", async () => {
  const [sql, config] = await Promise.all([
    readFile(new URL(
      "20260714175713_seed_toast_acquisition_core_operations.sql",
      migrations,
    ), "utf8"),
    readFile(new URL(
      "20260714175715_seed_toast_acquisition_config_operations.sql",
      migrations,
    ), "utf8"),
  ])

  assert.match(sql, /\('toast\.devices\.snapshot\.v1'[\s\S]{0,160}'device', 'collection'/)
  assert.match(sql, /\('toast\.restaurants\.get\.v1'[\s\S]{0,180}'restaurant', 'document', 'none', null, false, false, true\)/)
  assert.match(sql, /\('toast\.orders\.get\.v1'[\s\S]{0,160}'order', 'document', 'none', null, false, true, true\)/)
  assert.match(config, /'toast\.config\.' \|\| resource_key \|\| '\.get\.v1'/)
  assert.match(config, /'document', 'none', false, true, true/)
})

test("registers only supported labor collection parameters", async () => {
  const sql = await readFile(new URL(
    "20260714180026_seed_toast_acquisition_core_parameters.sql",
    migrations,
  ), "utf8")

  assert.doesNotMatch(sql, /\('toast\.labor\.shifts\.v1', 'includeArchived'/)
  assert.match(sql, /\('toast\.labor\.time_entries\.v1', 'includeMissedBreaks', 'query', 'boolean'/)
  assert.match(sql, /\('toast\.labor\.time_entries\.v1', 'includeArchived', 'query', 'boolean'/)
})

test("documents exact-resource policy consistently with registry flags", async () => {
  const catalog = await readFile(new URL(
    "../docs/toast-acquisition-catalog.md",
    import.meta.url,
  ), "utf8")

  assert.match(catalog, /Operations flagged `exact_resource_only` are repair-only/)
  assert.match(catalog, /\| Restaurants \| management-group members, restaurant detail \| none \|/)
  assert.match(catalog, /Restaurant detail is intentionally not flagged/)
  assert.doesNotMatch(catalog, /Exact-resource operations are repair-only/)
})
