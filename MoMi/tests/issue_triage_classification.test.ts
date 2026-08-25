import assert from "node:assert/strict"
import test from "node:test"

import { buildApplyPlan } from "../scripts/issue_triage/build_apply_plan.ts"
import { parseDeclaredIssueType } from
  "../scripts/issue_triage/parse_declared_issue_type.ts"
import type { IssueTriage } from "../scripts/issue_triage/types.ts"

const bug: IssueTriage = {
  schema_version: 1,
  issue_number: 219,
  issue_type: "bug",
  feature: { id: "classification-authority", title: "Classification authority" },
  relationships: [],
  safe_parallel: true,
  confidence: "high",
  rationale: "The model inferred a defect.",
  labels: ["bug"],
}

const evidence = {
  targetIssueNumber: 219,
  currentIssueNumber: 219,
  currentIssueOpen: true,
  currentIssueIsPullRequest: false,
  currentIssueBody: null as string | null,
  existingIssueNumbers: [219],
  availableLabels: ["bug", "enhancement"],
  matchingCommentIds: [] as number[],
}

function marker(issueNumber: number, issueType: unknown): string {
  return `<!-- momi-issue-classification:v1\n${JSON.stringify({
    schema_version: 1,
    issue_number: issueNumber,
    issue_type: issueType,
  })}\n-->`
}

test("unmarked issues retain bounded model classification", () => {
  assert.equal(parseDeclaredIssueType(219, "No declaration."), null)
  const plan = buildApplyPlan(bug, evidence)
  assert.deepEqual(plan.labels, ["bug"])
  assert.match(plan.body, /Issue type authority: \*\*model-inferred\*\*/)
})

test("issuer type overrides stale model type and managed label", () => {
  const featurePlan = buildApplyPlan(bug, {
    ...evidence,
    currentIssueBody: marker(219, "feature"),
  })
  assert.deepEqual(featurePlan.labels, ["enhancement"])
  assert.match(featurePlan.body, /Issue type: \*\*feature\*\*/)
  assert.match(featurePlan.body, /Issue type authority: \*\*issuer-declared\*\*/)
  const feature = { ...bug, issue_type: "feature" as const, labels: ["enhancement"] }
  const bugPlan = buildApplyPlan(feature, {
    ...evidence,
    currentIssueBody: marker(219, "bug"),
  })
  assert.deepEqual(bugPlan.labels, ["bug"])
  assert.match(bugPlan.body, /Issue type: \*\*bug\*\*/)
})

test("malformed or ambiguous classification declarations fail closed", () => {
  const valid = marker(219, "feature")
  assert.throws(() => parseDeclaredIssueType(219, `${valid}${valid}`), /Duplicate/)
  assert.throws(() => parseDeclaredIssueType(
    219,
    "<!-- momi-issue-classification:v1\n{oops\n-->",
  ), /Malformed/)
  assert.throws(() => parseDeclaredIssueType(219, marker(220, "feature")), /different/)
  assert.throws(() => parseDeclaredIssueType(219, marker(219, "task")), /issue type/)
  assert.throws(() => parseDeclaredIssueType(
    219,
    '<!-- momi-issue-classification:v1\n' +
      '{"schema_version":2,"issue_number":219,"issue_type":"feature"}\n-->',
  ), /schema version/)
  assert.throws(() => parseDeclaredIssueType(
    219,
    '<!-- momi-issue-classification:v1\n' +
      '{"schema_version":1,"issue_number":219,"issue_type":"feature","extra":true}\n-->',
  ), /fields/)
  assert.throws(() => parseDeclaredIssueType(
    219,
    '<!-- momi-issue-classification:v2\n{"schema_version":2}\n-->',
  ), /Unsupported/)
  const oversized = `<!-- momi-issue-classification:v1\n${JSON.stringify({
    schema_version: 1,
    issue_number: 219,
    issue_type: "feature",
    padding: "x".repeat(257),
  })}\n-->`
  assert.throws(() => parseDeclaredIssueType(219, oversized), /too large/)
})
