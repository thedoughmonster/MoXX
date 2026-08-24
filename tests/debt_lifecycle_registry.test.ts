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
  "schemas/debt-lifecycle-registry-v1.schema.json",
  "utf8",
))

function copy(): DebtLifecycleRegistry {
  return structuredClone(accepted)
}

test("covers every accepted fingerprint with the accepted issue partition", () => {
  assert.deepEqual(
    findDebtLifecycleViolations(findings, accepted, undefined, "2026-08-18"),
    [],
  )
  assert.deepEqual(
    Object.fromEntries(accepted.records.map((record) => [
      `#${record.remediation_issue}`,
      record.fingerprints.length,
    ])),
    { "#194": 57, "#195": 15, "#196": 7, "#572": 3 },
  )
})

test("rejects missing, duplicate, ownerless, overdue, and expired metadata", () => {
  const missing = copy()
  missing.records[0].fingerprints.pop()
  assert.match(
    findDebtLifecycleViolations(findings, missing, undefined, "2026-08-18").join("\n"),
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
    findDebtLifecycleViolations(findings, accepted, undefined, "2026-11-17")
      .join("\n"),
    /review is overdue[\s\S]*metadata is expired/,
  )
  const wrongIssue = copy()
  const moved = wrongIssue.records[0].fingerprints.shift()!
  wrongIssue.records[1].fingerprints.push(moved)
  wrongIssue.records[1].fingerprints.sort()
  assert.match(
    findDebtLifecycleViolations(findings, wrongIssue, undefined, "2026-08-18")
      .join("\n"),
    /maps to the wrong remediation issue/,
  )
})

test("requires append-only review history for lifecycle changes", () => {
  const rewritten = copy()
  rewritten.records[0].reviews[0].rationale =
    "A rewritten rationale that attempts to replace accepted history."
  assert.match(
    findDebtLifecycleViolations(
      findings,
      rewritten,
      accepted,
      "2026-08-18",
    ).join("\n"),
    /rewrites accepted review history/,
  )
  const silent = copy()
  silent.records[0].temporary_reason =
    "A materially different temporary reason without a new review artifact."
  assert.match(
    findDebtLifecycleViolations(findings, silent, accepted, "2026-08-18")
      .join("\n"),
    /changes lifecycle metadata without renewal/,
  )
})

test("accepts explicit renewal and same-change removal evidence", () => {
  const renewed = copy()
  renewed.policy.as_of = "2026-09-01"
  renewed.records[0].reviewed_on = "2026-09-01"
  renewed.records[0].next_review_on = "2026-10-01"
  renewed.records[0].expires_on = "2026-11-30"
  renewed.records[0].reviews.push({
    reviewed_on: "2026-09-01",
    reviewer: "Zac",
    decision: "renew",
    rationale: "Renewed after dated review of owner, risk, issue, and removal plan.",
  })
  assert.deepEqual(
    findDebtLifecycleViolations(findings, renewed, accepted, "2026-09-01"),
    [],
  )
  const removed = copy()
  const fingerprint = removed.records[0].fingerprints.shift()!
  const remaining = findings.filter((finding) => finding.fingerprint !== fingerprint)
  assert.deepEqual(
    findDebtLifecycleViolations(remaining, removed, accepted, "2026-08-18"),
    [],
  )
})
