import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(
  ".github/workflows/debt-lifecycle-issues.yml",
  "utf8",
)

test("trusted workflow always concludes for pull requests", () => {
  assert.match(workflow, /pull_request_target:/)
  assert.match(workflow, /schedule:/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.doesNotMatch(workflow, /\n\s+paths:/)
  assert.doesNotMatch(workflow, /actions\/checkout/)
  assert.match(workflow, /listFiles/)
  assert.match(workflow, /N\/A \(unrelated change\)/)
})

test("reads registry as data and fails closed on unknown remote state", () => {
  assert.match(workflow, /getContent/)
  assert.match(workflow, /Buffer\.from\(response\.data\.content, "base64"\)/)
  assert.match(workflow, /verification indeterminate/)
  assert.match(workflow, /record\.expires_on/)
  assert.match(workflow, /record\.next_review_on/)
  assert.match(workflow, /issue\.data\.state !== "open"/)
  assert.match(workflow, /core\.setFailed/)
  assert.doesNotMatch(workflow, /github\.rest\.issues\.update/)
})
