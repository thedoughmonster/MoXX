import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { validateJson } from "../scripts/architecture/validate_json.ts"
import type { DebtLifecycleRegistry } from "../scripts/constitution/debt_lifecycle_types.ts"
import { findDebtLifecycleViolations } from "../scripts/constitution/find_debt_lifecycle_violations.ts"
import { indexDebtLifecycleRecords } from "../scripts/constitution/index_debt_lifecycle_records.ts"
import { loadAccessBaseline } from "../scripts/constitution/load_access_baseline.ts"
import { loadConstitutionBaseline } from "../scripts/constitution/load_constitution_baseline.ts"
import { loadDebtLifecycleRegistry } from "../scripts/constitution/load_debt_lifecycle_registry.ts"

const access = await loadAccessBaseline()
const constitution = await loadConstitutionBaseline()
const findings = [...constitution.findings, ...access.findings]
const accepted = await loadDebtLifecycleRegistry()
const schema = JSON.parse(await readFile(
  "schemas/debt-lifecycle-registry-v2.schema.json",
  "utf8",
))

function copy(): DebtLifecycleRegistry {
  const fixture = structuredClone(accepted)
  fixture.policy.as_of = "2026-08-25"
  for (const record of fixture.records) {
    Object.assign(record, {
      introduced_on: "2026-08-18", reviewed_on: "2026-08-25",
      next_review_on: "2026-09-24", expires_on: "2026-11-16",
      reviews: [{ reviewed_on: "2026-08-25", reviewer: "Zac", decision: "accept",
        rationale: "Fixed test review independent of later approved registry reviews." }],
    })
  }
  return fixture
}

test("covers every accepted fingerprint with the accepted issue partition", () => {
  assert.equal(accepted.authority.work_authority, "linear")
  assert.deepEqual(
    findDebtLifecycleViolations(findings, accepted, undefined, accepted.policy.as_of),
    [],
  )
  assert.deepEqual(
    Object.fromEntries(accepted.records.map((record) => [
      record.remediation_issue,
      record.fingerprints.length,
    ])),
    { "MOX-20": 56, "MOX-22": 15, "MOX-23": 7, "MOX-406": 3 },
  )
})

test("rejects missing, duplicate, ownerless, overdue, and expired metadata", () => {
  const missing = copy()
  missing.records[0].fingerprints.pop()
  assert.match(
    findDebtLifecycleViolations(findings, missing, undefined, "2026-08-25").join("\n"),
    /missing lifecycle metadata/,
  )
  const duplicate = copy()
  duplicate.records[1].fingerprints.push(duplicate.records[0].fingerprints[0])
  assert.throws(() => indexDebtLifecycleRecords(duplicate), /duplicate lifecycle/)
  const ownerless = copy()
  ownerless.records[0].accountable_owner = ""
  assert.throws(
    () => validateJson(schema, ownerless, "fixture"),
    /fewer than 1 characters/,
  )
  assert.match(
    findDebtLifecycleViolations(findings, copy(), undefined, "2026-11-17")
      .join("\n"),
    /review is overdue[\s\S]*metadata is expired/,
  )
  const wrongIssue = copy()
  const moved = wrongIssue.records[0].fingerprints.shift()!
  wrongIssue.records[1].fingerprints.push(moved)
  wrongIssue.records[1].fingerprints.sort()
  assert.match(
    findDebtLifecycleViolations(findings, wrongIssue, undefined, "2026-08-25")
      .join("\n"),
    /maps to the wrong remediation issue/,
  )
  const githubIssue = copy()
  githubIssue.records[0].remediation_issue = "194"
  assert.throws(
    () => validateJson(schema, githubIssue, "fixture"),
    /must match pattern/,
  )
  for (const [field, date, message] of [
    ["next_review_on", "2026-10-01", "exceeds the review interval"],
    ["expires_on", "2026-11-24", "exceeds the expiry interval"],
  ] as const) {
    const interval = copy()
    interval.records[0][field] = date
    assert.ok(findDebtLifecycleViolations(findings, interval, undefined, "2026-08-25")
      .some((violation) => violation.includes(message)))
  }
})

test("requires append-only review history for lifecycle changes", () => {
  const rewritten = copy()
  rewritten.records[0].reviews[0].rationale =
    "A rewritten rationale that attempts to replace accepted history."
  assert.match(
    findDebtLifecycleViolations(findings, rewritten, copy(), "2026-08-25").join("\n"),
    /rewrites accepted review history/,
  )
  const silent = copy()
  silent.records[0].temporary_reason =
    "A materially different temporary reason without a new review artifact."
  assert.match(
    findDebtLifecycleViolations(findings, silent, copy(), "2026-08-25")
      .join("\n"),
    /changes lifecycle metadata without renewal/,
  )
})

test("accepts explicit renewal and same-change removal evidence", () => {
  const renewed = copy()
  renewed.policy.as_of = "2026-09-01"
  renewed.records[0].reviewed_on = "2026-09-01"
  renewed.records[0].next_review_on = "2026-10-01"
  renewed.records[0].reviews.push({
    reviewed_on: "2026-09-01",
    reviewer: "Zac",
    decision: "renew",
    rationale: "Renewed after dated review of owner, risk, issue, and removal plan.",
  })
  assert.equal(renewed.records[0].expires_on, copy().records[0].expires_on)
  assert.deepEqual(
    findDebtLifecycleViolations(findings, renewed, copy(), "2026-09-01"),
    [],
  )
  const removed = copy()
  const fingerprint = removed.records[0].fingerprints.shift()!
  const remaining = findings.filter((finding) => finding.fingerprint !== fingerprint)
  assert.deepEqual(
    findDebtLifecycleViolations(remaining, removed, copy(), "2026-08-25"),
    [],
  )
})
