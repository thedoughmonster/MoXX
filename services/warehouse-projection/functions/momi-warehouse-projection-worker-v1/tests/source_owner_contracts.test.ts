import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = await Promise.all([
  "20260817194618_expose_toast_archive_projection_reads.sql",
  "20260817194629_expose_toast_acquisition_projection_read.sql",
].map((name) => readFile(new URL(
  `../../../../../supabase/migrations/${name}`,
  import.meta.url,
), "utf8")))

test("source-owner reads expose only exact routine execution", () => {
  const sql = migrations.join("\n")
  assert.doesNotMatch(sql, /grant usage on schema/i)
  assert.equal((sql.match(/security definer/g) ?? []).length, 3)
  assert.equal((sql.match(/grant execute on function/g) ?? []).length, 3)
  assert.equal((sql.match(/to svc_warehouse_projection/g) ?? []).length, 3)
  assert.equal((sql.match(/from public, anon, authenticated, service_role/g) ?? [])
    .length, 3)
})
