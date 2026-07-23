import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(".github/workflows/issue-triage.yml", "utf8")
const model = workflow.slice(
  workflow.indexOf("  model:"),
  workflow.indexOf("  writer:"),
)
const writer = workflow.slice(workflow.indexOf("  writer:"))
const apply = await readFile("scripts/issue_triage/apply_triage.ts", "utf8")

test("model authority and context are bounded and read-only", () => {
  assert.match(model, /contents: read/)
  assert.match(model, /issues: read/)
  assert.doesNotMatch(model, /issues: write|contents: write/)
  assert.match(model, /timeout-minutes: 10/)
  assert.match(model, /sparse-checkout:/)
  assert.match(model, /node-version: 24\.14\.0/)
  assert.match(model, /sandbox: read-only/)
  assert.match(model, /safety-strategy: drop-sudo/)
  assert.match(model, /allow-users: "\*"/)
  assert.match(model, /codex-version: 0\.145\.0/)
  assert.match(
    model,
    /openai\/codex-action@e469131063221562acfb9ea6bbc9fd7f27226ffb/,
  )
})

test("writer has narrow write authority and no OpenAI credential", () => {
  assert.match(writer, /issues: write/)
  assert.match(writer, /contents: read/)
  assert.match(writer, /node-version: 24\.14\.0/)
  assert.doesNotMatch(writer, /OPENAI|openai-api-key|codex-action/)
  assert.match(writer, /timeout-minutes: 5/)
  assert.match(writer, /needs\.model\.outputs\.result/)
  assert.match(writer, /run_apply_triage\.ts/)
})

test("triggers and concurrency support bounded non-looping re-triage", () => {
  assert.match(workflow, /issues:\n    types: \[opened\]/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.doesNotMatch(workflow, /issue_comment:|types: \[(edited|labeled)/)
})

test("the Codex action is the last model-job step", () => {
  const action = model.indexOf("uses: openai/codex-action@")
  assert.ok(action > 0)
  assert.doesNotMatch(model.slice(action), /\n      - (name|uses):/)
})

test("writer finishes validation before its first mutation", () => {
  assert.ok(apply.indexOf("const plan = buildApplyPlan") > 0)
  assert.ok(apply.indexOf("const plan = buildApplyPlan") < apply.indexOf("method:"))
})
