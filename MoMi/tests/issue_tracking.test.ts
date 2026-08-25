import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  parsePullRequestIssueTracking,
} from "../scripts/issue_tracking/parse_pull_request_issue_tracking.ts"
import { assertIssueMatchesHeadRef } from "../scripts/issue_tracking/assert_issue_matches_head_ref.ts"

test("parses one owning Linear issue", () => {
  assert.deepEqual(
    parsePullRequestIssueTracking("Owning Linear issue: MOX-109"),
    { issueIdentifier: "MOX-109" },
  )
})

test("normalizes the owning Linear issue case", () => {
  assert.deepEqual(
    parsePullRequestIssueTracking("OWNING LINEAR ISSUE: mox-8"),
    { issueIdentifier: "MOX-8" },
  )
})

test("rejects absent, duplicate, and invalid metadata", () => {
  assert.throws(() => parsePullRequestIssueTracking(""))
  assert.throws(() => parsePullRequestIssueTracking(
    "Owning Linear issue: MOX-1\nOwning Linear issue: MOX-2",
  ))
  assert.throws(() => parsePullRequestIssueTracking(
    "Owning Linear issue: #1",
  ))
})

test("requires the body issue to match the sole branch issue", () => {
  assert.doesNotThrow(() =>
    assertIssueMatchesHeadRef("MOX-392", "mox-392-publish-remote")
  )
  assert.throws(() => assertIssueMatchesHeadRef("MOX-392", "docs-only"))
  assert.throws(() =>
    assertIssueMatchesHeadRef("MOX-392", "mox-391-and-mox-392")
  )
  assert.throws(() =>
    assertIssueMatchesHeadRef("MOX-392", "mox-391-publish-remote")
  )
})

test("workflow validates a fail-closed Linear issue mapping", async () => {
  const workflow = await readFile(
    "../.github/workflows/linear-issue-mapping.yml",
    "utf8",
  )
  assert.match(workflow, /check_pull_request_issue_tracking\.ts/)
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/)
  assert.match(workflow, /MOXX_HEAD_REF: \$\{\{ github\.head_ref \}\}/)
  assert.doesNotMatch(workflow, /pull_request_target:/)
  assert.doesNotMatch(workflow, /issues: write/)
  assert.doesNotMatch(workflow, /github\.rest\.issues/)
})
