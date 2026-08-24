import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = await Promise.all([
  "20260817194618_expose_toast_archive_projection_reads.sql",
  "20260817194629_expose_toast_acquisition_projection_read.sql",
  "20260824181717_expose_stock_snapshot_archive_reads.sql",
  "20260824181723_expose_stock_snapshot_projection_job_read.sql",
].map((name) => readFile(new URL(
  `../../../../../supabase/migrations/${name}`,
  import.meta.url,
), "utf8")))

test("source-owner reads expose only exact routine execution", () => {
  const sql = migrations.join("\n")
  assert.doesNotMatch(sql, /grant usage on schema/i)
  assert.equal((sql.match(/security definer/g) ?? []).length, 6)
  assert.equal((sql.match(/grant execute on function/g) ?? []).length, 6)
  assert.equal((sql.match(/to svc_warehouse_projection/g) ?? []).length, 6)
  assert.equal((sql.match(/from public, anon, authenticated, service_role/g) ?? [])
    .length, 6)
})

test("maps every stock snapshot owner read to its public contract", async () => {
  const root = new URL("../../../../../", import.meta.url)
  const [archive, acquisition, projection] = await Promise.all([
    "services/communications-archive/service.json",
    "services/toast-data-acquisition/service.json",
    "services/warehouse-projection/service.json",
  ].map((path) => readFile(new URL(path, root), "utf8")))
  assert.match(archive, /toast_raw\.read_stock_snapshot_attempt_v1/)
  assert.match(archive, /toast_raw\.read_stock_snapshot_observations_v1/)
  assert.match(acquisition,
    /toast\.acquisition\.stock_snapshot_projection_job\.v1/)
  assert.match(acquisition,
    /toast_acquisition\.read_stock_snapshot_projection_job_v1/)
  assert.match(projection,
    /toast\.acquisition\.stock_snapshot_projection_job\.v1/)
})
