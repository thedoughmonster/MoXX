import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

const migrations = new URL(
  "../../../../../supabase/migrations/",
  import.meta.url,
)

test("management-group restaurant references bypass generic projection", () => {
  const name = readdirSync(migrations).find((entry) =>
    entry.endsWith("_normalize_generic_resource_projection.sql")
  )
  assert.ok(name)
  const sql = readFileSync(new URL(name, migrations), "utf8")
  const ignored = sql.indexOf("return 'ignored_management_group_reference'")
  const resolved = sql.indexOf("location_id :=")
  const linked = sql.indexOf("warehouse_projection.link_source_entity(")
  const recorded = sql.indexOf("warehouse_projection.record_entity_version(")

  assert.match(sql, /source_version\.resource_type = 'restaurant'/)
  assert.match(sql, /attempt\.attempt_id = source_version\.first_attempt_id/)
  assert.match(sql, /attempt\.operation_key = 'toast\.restaurants\.group\.v1'/)
  assert.ok(ignored >= 0 && ignored < resolved)
  assert.ok(ignored < linked && ignored < recorded)
})
