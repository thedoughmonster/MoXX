import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../supabase/migrations/20260716182635_create_legacy_recipe_staging.sql",
  import.meta.url,
)

test("creates the source-neutral private staging ledger", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /^-- service-owner: warehouse-projection/m)
  for (const table of [
    "import_runs", "source_files", "import_batches", "source_tables",
    "source_rows", "repair_findings", "reconciliation_results",
  ]) assert.match(sql, new RegExp(`create table legacy_recipe_staging\\.${table}`))
  assert.match(sql, /row_document jsonb not null/)
  assert.match(sql, /row_payload text not null/)
  assert.match(sql, /finding_payload text not null/)
  assert.match(sql, /extensions\.digest\(convert_to\(row_payload, 'UTF8'\)/)
  assert.match(sql, /row_payload::jsonb = row_document/)
  assert.match(sql, /source_row_key text not null/)
  assert.match(sql, /rows_sha256 text not null/)
  assert.doesNotMatch(sql, /toast[_ ](?:id|guid)/i)
  assert.doesNotMatch(sql, /momi_warehouse\./)
})

test("denies Data API roles and makes evidence immutable", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /from public, anon, authenticated, service_role/g)
  assert.equal((sql.match(/enable row level security/g) ?? []).length, 7)
  assert.match(sql, /before update or delete or truncate[\s\S]+source_rows/)
  assert.match(sql, /before update or delete or truncate[\s\S]+repair_findings/)
  assert.match(sql, /create trigger import_runs_update_guard/)
  assert.match(sql, /create trigger import_runs_no_delete/)
  assert.match(sql, /create trigger import_batches_update_guard/)
  assert.match(sql, /create trigger import_batches_no_delete/)
  assert.match(sql, /to_jsonb\(new\) - array\[/)
  assert.match(sql, /legacy recipe import run provenance is immutable/)
  assert.match(sql, /legacy recipe import batch provenance is immutable/)
  assert.doesNotMatch(sql, /security definer/i)
  assert.doesNotMatch(sql, /create policy/i)
})

test("declares schema ownership and portable NAS preservation", async () => {
  const workspace = JSON.parse(await readFile(
    new URL("../workspace.json", import.meta.url), "utf8",
  )) as { database_schemas: string[] }
  const service = JSON.parse(await readFile(
    new URL("../services/warehouse-projection/service.json", import.meta.url), "utf8",
  )) as { database: { read: string[]; write: string[] } }
  const selector = await readFile(new URL(
    "../local-tools/postgres-nas-export/select_portable_schemas.ts",
    import.meta.url,
  ), "utf8")
  assert.ok(workspace.database_schemas.includes("legacy_recipe_staging"))
  assert.ok(service.database.read.includes("legacy_recipe_staging"))
  assert.ok(service.database.write.includes("legacy_recipe_staging"))
  assert.match(selector, /schema === "legacy_recipe_staging"/)
})
