import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const [archive, acquisition] = await Promise.all([
  "20260824181717_expose_stock_snapshot_archive_reads.sql",
  "20260824181723_expose_stock_snapshot_projection_job_read.sql",
].map((name) => readFile(new URL(name, migrations), "utf8")))
const archiveDefinitions = archive.slice(0, archive.indexOf("comment on function"))
const acquisitionDefinition = acquisition.slice(
  0, acquisition.indexOf("comment on function"),
)

test("owner reads preserve exact snapshot inputs", async () => {
  const database = new PGlite()
  try {
    await database.exec(`
      create schema toast_raw; create schema toast_acquisition;
      create table toast_raw.api_request_attempts (
        attempt_id uuid primary key, job_id bigint, started_at timestamptz,
        finished_at timestamptz, http_status integer, response_json jsonb);
      create table toast_raw.resource_versions (
        resource_version_id uuid primary key, resource_type text, payload jsonb);
      create table toast_raw.resource_observations (
        observation_id bigint primary key, resource_version_id uuid,
        attempt_id uuid, correlation_id uuid);
      create table toast_acquisition.jobs (
        job_id bigint primary key, operation_key text, status text, mode text,
        restaurant_guid text);
      ${archiveDefinitions} ${acquisitionDefinition}
      insert into toast_raw.api_request_attempts values
        ('00000000-0000-0000-0000-000000000101', 7, '2026-08-24 01:00Z',
          '2026-08-24 02:00Z', 200, '[]'),
        ('00000000-0000-0000-0000-000000000102', 7, '2026-08-24 02:00Z',
          '2026-08-24 03:00Z', 200, '[]'),
        ('00000000-0000-0000-0000-000000000103', 7, '2026-08-24 03:00Z',
          '2026-08-24 04:00Z', 500, '[]');
      insert into toast_raw.resource_versions values
        ('00000000-0000-0000-0000-000000000201', 'stock_state',
          '{"guid":"item-a"}'),
        ('00000000-0000-0000-0000-000000000202', 'stock_state',
          '{"guid":"item-b","multiLocationId":"multi-b","itemGuidValidity":"INVALID"}'),
        ('00000000-0000-0000-0000-000000000203', 'menu', '{}');
      insert into toast_raw.resource_observations values
        (1, '00000000-0000-0000-0000-000000000201',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000301'),
        (2, '00000000-0000-0000-0000-000000000202',
          '00000000-0000-0000-0000-000000000103',
          '00000000-0000-0000-0000-000000000302'),
        (3, '00000000-0000-0000-0000-000000000203',
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000303');
      insert into toast_acquisition.jobs values
        (7, 'toast.stock.snapshot.v1', 'succeeded', 'snapshot', 'location-a');
    `)
    const attempt = await database.query<{ attempt_id: string }>(
      "select attempt_id::text from toast_raw.read_stock_snapshot_attempt_v1(7)",
    )
    assert.equal(attempt.rows[0].attempt_id,
      "00000000-0000-0000-0000-000000000102")
    const observations = await database.query<{
      observation_id: number, projection_eligible: boolean,
      item_guid_validity: string, item_guid: string,
    }>(`select observation_id, projection_eligible, item_guid_validity,
      item_guid from toast_raw.read_stock_snapshot_observations_v1(7)`)
    assert.deepEqual(observations.rows, [
      { observation_id: 1, projection_eligible: true,
        item_guid_validity: "VALID", item_guid: "item-a" },
      { observation_id: 2, projection_eligible: false,
        item_guid_validity: "INVALID", item_guid: "item-b" },
    ])
    const job = await database.query(`select * from
      toast_acquisition.read_stock_snapshot_projection_job_v1(7)`)
    assert.deepEqual(job.fields.map((field) => field.name),
      ["job_id", "operation_key", "status", "mode", "restaurant_guid"])
    assert.deepEqual(job.rows[0], { job_id: 7,
      operation_key: "toast.stock.snapshot.v1", status: "succeeded",
      mode: "snapshot", restaurant_guid: "location-a" })
  } finally {
    await database.close()
  }
})
