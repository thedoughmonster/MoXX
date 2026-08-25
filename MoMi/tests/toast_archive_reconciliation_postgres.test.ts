import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

test("executes exact archive reconciliation and transactional rollback", async () => {
  const fixture = await readFile(new URL(
    "./fixtures/toast-archive-reconciliation.sql", import.meta.url,
  ), "utf8")
  const migration = await readFile(new URL(
    "../supabase/migrations/20260823160051_reconcile_toast_archive_acceptance.sql",
    import.meta.url,
  ), "utf8")
  const database = new PGlite({ extensions: { pgcrypto } })
  await database.exec(fixture)
  const targetFilter = `record_key in (
    'toast.labor.shifts.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    'toast.labor.time_entries.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    'toast.orders.bulk.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01',
    '42986')`
  const before = await database.query<{ count: number }>(
    `select count(*)::integer as count
     from toast_acquisition.archive_acceptance_findings_v1
     where ${targetFilter}`,
  )
  assert.equal(before.rows[0].count, 4)
  const jobsBefore = await database.query<{ snapshot: string }>(`
    select jsonb_agg(to_jsonb(job) order by job_id)::text as snapshot
    from toast_acquisition.jobs as job`)
  const rawBefore = await database.query<{ snapshot: string }>(`
    select jsonb_agg(to_jsonb(raw) order by observation_id)::text as snapshot
    from toast_raw.resource_observations as raw`)
  const hashes = await database.query<{ valid: boolean }>(`
    select bool_and(response_sha256 = encode(extensions.digest(
      convert_to(response_body, 'UTF8'), 'sha256'), 'hex')) as valid
    from toast_raw.api_request_attempts`)
  assert.equal(hashes.rows[0].valid, true)

  await database.exec("begin")
  await database.exec(`delete from
    toast_acquisition.expected_archive_obligations_v1
    where obligation_key like 'toast.labor.shifts.v1:%'`)
  await assert.rejects(database.exec(migration), /target set drifted/)
  await database.exec("rollback")

  await database.exec("begin")
  await database.exec(`update toast_acquisition.test_integrity_findings
    set details = jsonb_build_object(
      'attempt_id', '00000000-0000-0000-0000-000000000001'::uuid,
      'resource_version_id', '00000000-0000-0000-0000-000000000002'::uuid)
    where record_key = '42986'`)
  await assert.rejects(database.exec(migration), /finding evidence drifted/)
  await database.exec("rollback")

  await database.exec("begin")
  await database.exec(migration)
  await assert.rejects(database.exec(`update
    toast_acquisition.archive_finding_reconciliations
    set disposition = 'evidence_valid'`), /immutable/)
  await database.exec("rollback")
  const rolledBack = await database.query<{ relation: string | null }>(`
    select to_regclass(
      'toast_acquisition.archive_finding_reconciliations'
    )::text as relation`)
  assert.equal(rolledBack.rows[0].relation, null)
  const restored = await database.query<{ count: number }>(`
    select count(*)::integer as count
    from toast_acquisition.archive_acceptance_findings_v1
    where ${targetFilter}`)
  assert.equal(restored.rows[0].count, 4)

  await database.exec(migration)
  const resolved = await database.query<{ count: number }>(`
    select count(*)::integer as count
    from toast_acquisition.archive_acceptance_findings_v1
    where ${targetFilter}`)
  assert.equal(resolved.rows[0].count, 0)
  await database.exec(`update toast_acquisition.test_integrity_findings
    set record_key = '42986'
    where record_key = '42987'`)
  const remaining = await database.query<{ record_key: string }>(`
    select record_key from toast_acquisition.archive_acceptance_findings_v1
    order by record_key`)
  assert.deepEqual(remaining.rows.map((row) => row.record_key), [
    "42982", "42986", "near-miss-window", "unrelated-containing-window",
  ])

  for (const statement of [
    "update toast_acquisition.archive_finding_reconciliations set evidence = '{}'",
    "delete from toast_acquisition.archive_finding_reconciliations",
    "truncate toast_acquisition.archive_finding_reconciliations",
  ]) await assert.rejects(database.exec(statement), /immutable/)
  const jobsAfter = await database.query<{ snapshot: string }>(`
    select jsonb_agg(to_jsonb(job) order by job_id)::text as snapshot
    from toast_acquisition.jobs as job`)
  const rawAfter = await database.query<{ snapshot: string }>(`
    select jsonb_agg(to_jsonb(raw) order by observation_id)::text as snapshot
    from toast_raw.resource_observations as raw`)
  assert.equal(jobsAfter.rows[0].snapshot, jobsBefore.rows[0].snapshot)
  assert.equal(rawAfter.rows[0].snapshot, rawBefore.rows[0].snapshot)
  await database.close()
})
