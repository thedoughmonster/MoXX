import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parsePullRequestIssueTracking } from "../scripts/issue_tracking/parse_pull_request_issue_tracking.ts"

test("parses one partial owning issue", () => {
  assert.deepEqual(
    parsePullRequestIssueTracking("Owning issue: #109\nDisposition: partial"),
    { issueNumber: 109, disposition: "partial" },
  )
})

test("parses one complete owning issue case-insensitively", () => {
  assert.deepEqual(
    parsePullRequestIssueTracking("OWNING ISSUE: #8\nDISPOSITION: COMPLETE"),
    { issueNumber: 8, disposition: "complete" },
  )
})

test("rejects absent, duplicate, and invalid metadata", () => {
  assert.throws(() => parsePullRequestIssueTracking(""))
  assert.throws(() => parsePullRequestIssueTracking(
    "Owning issue: #1\nOwning issue: #2\nDisposition: partial",
  ))
  assert.throws(() => parsePullRequestIssueTracking(
    "Owning issue: #1\nDisposition: deferred",
  ))
})

test("workflow validates and reconciles development PRs", async () => {
  const workflow = await readFile(".github/workflows/issue-ledger.yml", "utf8")
  const reconcile = workflow.slice(workflow.indexOf("  reconcile:"))
  assert.match(workflow, /check_pull_request_issue_tracking\.ts/)
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/)
  assert.match(workflow, /pull_request_target:/)
  assert.match(workflow, /issues: write/)
  assert.match(workflow, /disposition === "complete"/)
  assert.match(workflow, /github\.rest\.issues\.get/)
  assert.match(workflow, /!label\.startsWith\("status:"\)/)
  assert.match(workflow, /issue_number,\n\s+labels,\n\s+state: "closed"/)
  assert.match(workflow, /state: "closed"/)
  assert.match(workflow, /momi-issue-ledger:v1 pr=/)
  assert.match(workflow, /comments\.some/)
  assert.match(workflow, /if \(!comments\.some/)
  assert.doesNotMatch(reconcile, /actions\/checkout/)
})
