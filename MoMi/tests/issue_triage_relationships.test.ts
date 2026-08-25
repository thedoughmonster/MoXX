import assert from "node:assert/strict"
import test from "node:test"

import { buildApplyPlan } from "../scripts/issue_triage/build_apply_plan.ts"
import { parseDeclaredRelationships } from
  "../scripts/issue_triage/parse_declared_relationships.ts"
import type { IssueTriage } from "../scripts/issue_triage/types.ts"
import { validateTriage } from "../scripts/issue_triage/validate_triage.ts"

const valid: IssueTriage = {
  schema_version: 1,
  issue_number: 200,
  issue_type: "bug",
  feature: { id: "triage-authority", title: "Triage relationship authority" },
  relationships: [],
  safe_parallel: true,
  confidence: "high",
  rationale: "Issuer scheduling metadata must remain authoritative.",
  labels: ["bug"],
}

const evidence = {
  targetIssueNumber: 200,
  currentIssueNumber: 200,
  currentIssueOpen: true,
  currentIssueIsPullRequest: false,
  currentIssueBody: null as string | null,
  existingIssueNumbers: [200, 199, 170, 109, 110, 111, 112, 113, 114, 115],
  availableLabels: ["bug", "enhancement"],
  matchingCommentIds: [] as number[],
}

function marker(issueNumber: number, relationships: unknown[]): string {
  return `<!-- momi-issue-relationships:v1\n${JSON.stringify({
    schema_version: 1,
    issue_number: issueNumber,
    relationships,
  })}\n-->`
}

test("unmarked issues preserve inferred-only behavior", () => {
  assert.deepEqual(parseDeclaredRelationships(200, "No declaration."), [])
  const plan = buildApplyPlan(valid, evidence)
  assert.match(plan.body, /None identified/)
  assert.match(plan.body, /Safe parallel work \(deterministic\): \*\*yes\*\*/)
  const pessimistic = buildApplyPlan({ ...valid, safe_parallel: false }, evidence)
  assert.match(pessimistic.body, /Safe parallel work \(deterministic\): \*\*yes\*\*/)
})

test("latest issuer declaration replaces or supplies model relationships", () => {
  const rationale = "This P0 slice lands before the remaining issue 199 implementation."
  const declared = marker(200, [{ issue_number: 199,
    type: "ordering_constraint", direction: "current_before_related", rationale }])
  const candidate = structuredClone(valid)
  candidate.relationships = [
    { issue_number: 199, type: "hard_prerequisite",
      direction: "current_after_related", rationale: "Issue 199 must land first." },
    { issue_number: 170, type: "independent", direction: "not_applicable",
      rationale: "Issue 170 can proceed independently." },
  ]
  candidate.safe_parallel = true
  const plan = buildApplyPlan(candidate, { ...evidence, currentIssueBody: declared })
  assert.match(plan.body, new RegExp(`#199 - ordering_constraint; ` +
    `current_before_related; issuer-declared: ${rationale}`))
  assert.doesNotMatch(plan.body, /#199 - hard_prerequisite/)
  assert.match(plan.body, /#170 - independent; not_applicable; model-inferred/)
  assert.match(plan.body, /Safe parallel work \(deterministic\): \*\*no\*\*/)
  const omitted = buildApplyPlan(valid, { ...evidence, currentIssueBody: declared })
  assert.match(omitted.body, /#199 - ordering_constraint; current_before_related/)
})

test("malformed, ambiguous, and impossible declarations fail closed", () => {
  const relationship = { issue_number: 199, type: "ordering_constraint",
    direction: "current_before_related", rationale: "Issue 200 lands first." }
  const validMarker = marker(200, [relationship])
  assert.throws(() => parseDeclaredRelationships(200, `${validMarker}${validMarker}`))
  assert.throws(() => parseDeclaredRelationships(
    200,
    "<!-- momi-issue-relationships:v1\n{oops\n-->",
  ))
  assert.throws(() => parseDeclaredRelationships(200, marker(201, [relationship])))
  assert.throws(() => parseDeclaredRelationships(
    200,
    marker(200, [relationship, relationship]),
  ))
  for (const invalid of [
    { ...relationship, type: "hard_prerequisite",
      direction: "current_before_related" },
    { ...relationship, direction: "not_applicable" },
  ]) assert.throws(() => parseDeclaredRelationships(200, marker(200, [invalid])))
})

test("final relationship total remains bounded after authoritative overlay", () => {
  const declarations = Array.from({ length: 8 }, (_, index) => ({
    issue_number: 109 + index,
    type: "independent",
    direction: "not_applicable",
    rationale: `Related issue ${109 + index} can proceed independently.`,
  }))
  const candidate = structuredClone(valid)
  candidate.relationships = [{ issue_number: 199, type: "independent",
    direction: "not_applicable", rationale: "Issue 199 can proceed independently." }]
  assert.throws(() => buildApplyPlan(candidate, {
    ...evidence,
    currentIssueBody: marker(200, declarations),
  }), /bounded maximum/)
})

test("model relationships reject incompatible structured direction", () => {
  for (const relationship of [
    { issue_number: 199, type: "hard_prerequisite",
      direction: "current_before_related", rationale: "Issue 200 lands first." },
    { issue_number: 199, type: "ordering_constraint",
      direction: "not_applicable", rationale: "The sequence is constrained." },
  ]) assert.throws(() => validateTriage({ ...valid, relationships: [relationship] }))
})
