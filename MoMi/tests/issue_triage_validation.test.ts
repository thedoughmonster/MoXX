import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import Ajv2020 from "ajv/dist/2020.js"

import { buildApplyPlan } from "../scripts/issue_triage/build_apply_plan.ts"
import { relationshipTypes, type IssueTriage } from
  "../scripts/issue_triage/types.ts"
import { validateTriage } from "../scripts/issue_triage/validate_triage.ts"

const valid: IssueTriage = {
  schema_version: 1,
  issue_number: 136,
  issue_type: "feature",
  feature: { id: "issue-triage", title: "Automated issue triage" },
  relationships: [],
  safe_parallel: true,
  confidence: "high",
  rationale: "The issue defines bounded feature and dependency triage.",
  labels: ["enhancement"],
}
const evidence = {
  targetIssueNumber: 136,
  currentIssueNumber: 136,
  currentIssueOpen: true,
  currentIssueIsPullRequest: false,
  currentIssueBody: null,
  existingIssueNumbers: [136, 109],
  availableLabels: ["bug", "enhancement"],
  matchingCommentIds: [] as number[],
}

test("bug and feature records retain one owning feature graph", () => {
  const bug = structuredClone(valid)
  bug.issue_type = "bug"
  bug.labels = ["bug"]
  bug.relationships = [{
    issue_number: 109,
    type: "hard_prerequisite",
    direction: "current_after_related",
    rationale: "Depends on owning feature #109.",
  }]
  bug.safe_parallel = false
  assert.equal(validateTriage(bug).issue_type, "bug")
  assert.equal(validateTriage(valid).issue_type, "feature")
})

test("all relationship types and safe issue-reference punctuation work", () => {
  for (const type of relationshipTypes) {
    const candidate = structuredClone(valid)
    candidate.relationships = [{
      issue_number: 109,
      type,
      direction: type === "hard_prerequisite"
        ? "current_after_related"
        : type === "ordering_constraint"
        ? "current_before_related"
        : "not_applicable",
      rationale: "Related to owning feature #109; ordering is explicit.",
    }]
    candidate.safe_parallel = type === "independent"
    assert.equal(validateTriage(candidate).relationships[0].type, type)
  }
  const constrained = structuredClone(valid)
  constrained.relationships = [{ issue_number: 109, type: "ordering_constraint",
    direction: "current_before_related", rationale: "Issue 136 lands first." }]
  constrained.safe_parallel = true
  assert.match(buildApplyPlan(constrained, evidence).body,
    /Safe parallel work \(deterministic\): \*\*no\*\*/)
})

test("duplicates, missing references, and mismatched labels fail closed", () => {
  const duplicate = structuredClone(valid)
  duplicate.relationships = Array.from({ length: 2 }, () => ({
    issue_number: 109,
    type: "independent" as const,
    direction: "not_applicable" as const,
    rationale: "Related to owning feature #109.",
  }))
  assert.throws(() => validateTriage(duplicate))
  const related = structuredClone(valid)
  related.relationships = [{
    issue_number: 404,
    type: "independent",
    direction: "not_applicable",
    rationale: "Related to owning feature #404.",
  }]
  assert.throws(() => buildApplyPlan(related, evidence))
  assert.throws(() => validateTriage({ ...valid, labels: ["bug"] }))
})

test("schema and validator reject the same unsafe rationale punctuation", async () => {
  const schema = JSON.parse(
    await readFile(".github/codex/issue-triage.schema.json", "utf8"),
  )
  const validateSchema = new Ajv2020({ strict: false }).compile(schema)
  const candidate = { ...valid, rationale: "Unexpected [markup]" }
  assert.equal(validateSchema(candidate), false)
  assert.throws(() => validateTriage(candidate))
})

test("first run creates and rerun updates one marker idempotently", () => {
  const create = buildApplyPlan(valid, evidence)
  assert.equal(create.commentId, undefined)
  assert.match(create.body, /momi-issue-triage:v1 issue=136/)
  const update = buildApplyPlan(valid, { ...evidence, matchingCommentIds: [77] })
  assert.equal(update.commentId, 77)
  assert.equal(update.body, create.body)
  assert.throws(() => buildApplyPlan(valid, {
    ...evidence,
    matchingCommentIds: [77, 88],
  }))
})
