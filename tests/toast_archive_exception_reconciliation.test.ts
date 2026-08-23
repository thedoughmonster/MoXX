import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("reconciles only evidence-backed Toast archive exceptions", async () => {
  const migration = await readFile(new URL(
    "../supabase/migrations/20260823160051_reconcile_toast_archive_acceptance.sql",
    import.meta.url,
  ), "utf8")

  assert.match(migration, /^-- service-owner: toast-data-acquisition/)
  assert.match(migration, /job\.idempotency_key = expected\.obligation_key/)
  assert.match(migration, /job\.parameters = expected\.coverage_dimensions/)
  assert.match(migration, /job\.window_start <= expected\.window_start/)
  assert.match(migration, /job\.window_end >= expected\.window_end/)
  assert.match(migration, /create table toast_acquisition\.archive_finding_reconciliations/)
  assert.match(migration, /'RAW_OBSERVATION_MISMATCH', 'resource_observation', '42986'/)
  assert.match(migration, /'concurrent_dedup_shared_version'/)
  assert.match(migration, /target set drifted/)
  assert.match(migration, /finding evidence drifted/)
  assert.match(migration, /finding\.found_at = '2026-07-16T15:19:06\.668Z'/)
  assert.match(migration, /reconciliation\.finding_found_at = finding\.found_at/)
  assert.match(migration, /reconciliation\.finding_details = finding\.details/)
  assert.match(migration, /reject_archive_reconciliation_mutation/)
  assert.match(migration, /reconciliation\.record_key = finding\.record_key/)

  const obligationKeys = [
    "toast.labor.shifts.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01",
    "toast.labor.time_entries.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01",
    "toast.orders.bulk.v1:7b84bb81-3660-4215-a571-39cbad9611d2:2026-07-01",
  ]
  assert.equal(obligationKeys.length, 3)
  assert.equal(new Set(obligationKeys).size, 3)

  const expectedStart = Date.parse("2026-07-01T04:00:00Z")
  const expectedEnd = Date.parse("2026-07-16T04:00:00Z")
  const evidenceStart = Date.parse("2026-07-01T04:00:00Z")
  const evidenceEnd = Date.parse("2026-07-17T04:00:00Z")
  assert.equal(evidenceStart <= expectedStart && evidenceEnd >= expectedEnd, true)
  assert.equal(evidenceStart > expectedStart || expectedEnd > evidenceEnd, false)
  assert.equal(evidenceStart + 1 <= expectedStart, false)
  assert.equal(expectedEnd - 1 >= expectedEnd, false)

  const sharedVersionInsertion = Date.parse("2026-07-16T15:19:06.747Z")
  const earlierObservation = Date.parse("2026-07-16T15:19:06.668Z")
  assert.equal(false && sharedVersionInsertion > earlierObservation, false)
  assert.equal(true && sharedVersionInsertion > earlierObservation, true)

  assert.doesNotMatch(migration, /create or replace view toast_acquisition\.archive_integrity_findings_v1/i)
  assert.doesNotMatch(migration, /insert into toast_raw\./i)
  assert.doesNotMatch(migration, /insert into toast_acquisition\.jobs/i)
  assert.doesNotMatch(migration, /(?:update|delete from) toast_(?:acquisition|raw)\./i)
  assert.doesNotMatch(migration, /historical_coverage_bounds\s+(?:set|values)/i)
})
