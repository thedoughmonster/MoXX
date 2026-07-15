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
  ]
  const [policy, evidence, ledger, findings] = await Promise.all(
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
})
