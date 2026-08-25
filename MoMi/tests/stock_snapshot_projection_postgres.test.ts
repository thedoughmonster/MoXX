import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const [fixture, archive, acquisition, eventOwner, cutover] = await Promise.all([
  readFile(new URL("fixtures/stock_snapshot_projection.sql", import.meta.url), "utf8"),
  readFile(new URL("20260824181717_expose_stock_snapshot_archive_reads.sql",
    migrations), "utf8"),
  readFile(new URL("20260824181723_expose_stock_snapshot_projection_job_read.sql",
    migrations), "utf8"),
  readFile(new URL("20260817185245_add_momi_event_owner_contracts.sql",
    migrations), "utf8"),
  readFile(new URL("20260824181728_cut_stock_snapshot_to_owner_contracts.sql",
    migrations), "utf8"),
])
const archiveDefinitions = archive.slice(0, archive.indexOf("comment on function"))
const acquisitionDefinition = acquisition.slice(
  0, acquisition.indexOf("comment on function"),
)
const appendStart = eventOwner.indexOf(
  "create function momi_events.append_warehouse_event_v1",
)
const appendDefinition = eventOwner.slice(
  appendStart, eventOwner.indexOf("comment on function", appendStart),
)

test("stock snapshot cutover preserves batch identity and inference", async () => {
  const database = new PGlite({ extensions: { pgcrypto } })
  try {
    await database.exec(fixture)
    await database.exec(archiveDefinitions)
    await database.exec(acquisitionDefinition)
    await database.exec(appendDefinition)
    await database.exec(cutover)
    const correlation = "00000000-0000-0000-0000-000000000701"
    const project = `select warehouse_projection.project_toast_stock_snapshot(
      1, '${correlation}') as disposition`
    const first = await database.query<{ disposition: string }>(project)
    const replay = await database.query<{ disposition: string }>(project)
    assert.equal(first.rows[0].disposition, "projected_stock_snapshot")
    assert.equal(replay.rows[0].disposition, "projected_stock_snapshot")
    const observations = await database.query<{
      source_observation_key: string, snapshot_id: string, attempt_id: string | null,
    }>(`select source_observation_key, snapshot_id::text,
      source_reference ->> 'id' as attempt_id
      from momi_warehouse.stock_observations order by source_observation_key`)
    assert.deepEqual(observations.rows.map((row) => row.source_observation_key), [
      "toast:resource-observation:1",
      "toast:stock-job:1:inferred:00000000-0000-0000-0000-000000000503",
    ])
    assert.equal(new Set(observations.rows.map((row) => row.snapshot_id)).size, 1)
    assert.equal(observations.rows[1].attempt_id,
      "00000000-0000-0000-0000-000000000102")
    const calls = await database.query<{ observation_id: number }>(
      "select observation_id::integer from warehouse_projection.projection_calls",
    )
    assert.deepEqual(calls.rows.map((row) => row.observation_id), [1, 3, 1, 3])
    const events = await database.query<{
      event_count: number, observed_at: string, observation_count: string,
      correlation_id: string, source_id: string,
    }>(`select count(*)::integer as event_count, min(occurred_at)::text as observed_at,
      min(source_reference ->> 'observation_count') as observation_count,
      min(correlation_id::text) as correlation_id, min(source_id) as source_id
      from momi_events.events`)
    assert.deepEqual(events.rows[0], { event_count: 1,
      observed_at: "2026-08-24 03:00:00+00", observation_count: "2",
      correlation_id: correlation, source_id: "1" })
    const ignored = await database.query<{ disposition: string }>(`select
      warehouse_projection.project_toast_stock_snapshot(
        2, '${correlation}') as disposition`)
    assert.equal(ignored.rows[0].disposition, "ignored_non_stock_job")
    await assert.rejects(database.query(`select
      warehouse_projection.project_toast_stock_snapshot(
        3, '${correlation}')`), /stock_job_incomplete/)
    await assert.rejects(database.query(`select
      warehouse_projection.project_toast_stock_snapshot(
        1, '00000000-0000-0000-0000-000000000702')`),
    /warehouse event append replay conflicts/)
  } finally {
    await database.close()
  }
})
