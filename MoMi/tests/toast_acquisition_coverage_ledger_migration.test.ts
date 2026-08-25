import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("creates a private, job-addressable Toast coverage ledger", async () => {
  const migrationRoot = new URL("../supabase/migrations/", import.meta.url)
  const names = [
    "20260715125026_create_toast_archive_coverage_ledger.sql",
    "20260715125138_link_toast_archive_coverage_evidence.sql",
    "20260715125152_create_toast_archive_coverage_views.sql",
    "20260715125633_create_toast_archive_integrity_findings.sql",
    "20260715145800_create_expected_archive_obligations.sql",
    "20260715145900_surface_archive_obligation_gaps.sql",
  ]
  const [policy, evidence, ledger, findings, expected, acceptance] = await Promise.all(
    names.map((name) => readFile(new URL(name, migrationRoot), "utf8")),
  )

  for (const sql of [policy, evidence, ledger, findings]) {
    assert.match(sql, /^-- service-owner: toast-data-acquisition/)
  }
  assert.match(policy, /toast-exit-archive-v1/)
  assert.match(policy, /date '2026-11-29'/)
  assert.match(policy, /'historical', 'current_only', 'repair_only'/)
  assert.match(policy, /from toast_acquisition\.operations as operation where operation\.is_enabled/)
  assert.match(policy, /dependency_kind/)
  assert.match(policy, /toast-paid-analytics/)
  assert.match(policy, /toast-write-operations/)
  assert.match(policy, /toast-stock-search-post/)
  assert.match(policy, /enable row level security/g)

  assert.match(evidence, /add column job_id bigint references toast_acquisition\.jobs/)
  assert.match(evidence, /coverage_dimensions jsonb not null/)
  assert.match(evidence, /terminal_attempt_id uuid references/)
  assert.match(evidence, /add column pagination_generation integer not null/)
  assert.match(evidence, /pagination_generation = pagination_generation \+ 1/)
  assert.match(evidence, /preserve_coverage_evidence/)
  assert.match(evidence, /errcode = '55000'/)

  assert.match(ledger, /create view toast_acquisition\.coverage_ledger_v1/)
  assert.match(ledger, /with \(security_invoker = true\)/g)
  assert.match(ledger, /job\.idempotency_key as obligation_key/)
  assert.match(ledger, /job\.parameters ->> 'date_selector'/)
  assert.match(ledger, /'missing_attempt'/)
  assert.match(ledger, /attempt\.pagination_generation = job\.pagination_generation/g)
  assert.match(ledger, /revoke all on toast_acquisition\.coverage_ledger_v1/)

  assert.match(findings, /RAW_JOB_MISMATCH/)
  assert.match(findings, /RAW_RESPONSE_INVALID/)
  assert.match(findings, /extensions\.digest/)
  assert.match(findings, /RAW_OBSERVATION_MISMATCH/)
  assert.match(findings, /ACQUISITION_DEAD_LETTER/)
  assert.match(findings, /an empty result is required/)

  assert.match(expected, /create table toast_acquisition\.operation_coverage_dimensions/)
  assert.match(expected, /create table toast_acquisition\.historical_coverage_bounds/)
  assert.match(expected, /date '2026-07-15'/)
  assert.match(expected, /create view toast_acquisition\.expected_archive_obligations_v1/)
  assert.match(expected, /restaurant\.first_business_date/)
  assert.match(expected, /generate_series/g)
  assert.match(expected, /paidBusinessDate/)
  assert.match(expected, /refundBusinessDate/)
  assert.match(expected, /voidBusinessDate/)
  assert.match(expected, /includeMissedBreaks/)

  assert.match(acceptance, /'missing_job'/)
  assert.match(acceptance, /EXPECTED_JOB_MISSING/)
  assert.match(acceptance, /EXPECTED_JOB_UNRESOLVED/)
  assert.match(acceptance, /BACKFILL_ANCHOR_MISSING/)
  assert.match(acceptance, /COVERAGE_DIMENSION_MISSING/)
  assert.match(acceptance, /HISTORICAL_BOUND_MISSING/)
  assert.match(acceptance, /EXPECTED_SCHEDULE_MISSING/)
  assert.match(acceptance, /archive_acceptance_findings_v1/)
  assert.match(acceptance, /job\.window_start = expected\.window_start/)
  assert.match(acceptance, /job\.parameters = expected\.coverage_dimensions/)
})
