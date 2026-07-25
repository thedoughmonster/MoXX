import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(".github/workflows/validate.yml", "utf8")

test("runs one exact path-derived final gate for pull requests", () => {
  assert.match(workflow, /pull_request:\n    branches: \[dev\]/)
  assert.match(workflow, /validate-final:/)
  assert.match(workflow, /name: validate-final/)
  assert.match(workflow, /github\.event\.pull_request\.base\.sha/)
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/)
  assert.match(workflow, /development_baseline_sha:\n\s+description:[^\n]+\n\s+required: true/)
  assert.match(workflow,
    /MOMI_DEV_REF: \$\{\{ github\.event\.pull_request\.base\.sha \|\| inputs\.development_baseline_sha \}\}/)
  assert.match(workflow, /momi-impact plan/)
  assert.match(workflow, /momi-check changed --final/)
  assert.match(workflow, /validation-receipt\.json/)
})

test("does not repeat final validation on dev or prod pushes", () => {
  assert.doesNotMatch(workflow, /^\s*push:/m)
  assert.doesNotMatch(workflow, /actions\/workflows\/validate\.yml\/runs/)
  assert.doesNotMatch(workflow, /status=success|gh run watch/)
})
