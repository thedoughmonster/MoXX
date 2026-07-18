import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(
  new URL("../.github/workflows/validate.yml", import.meta.url),
  "utf8",
)

test("anchors development pushes to the last successful validation", () => {
  assert.match(workflow, /actions: read/)
  assert.doesNotMatch(workflow, /github\.event\.before/)
  assert.match(workflow, /actions\/workflows\/validate\.yml\/runs/)
  assert.match(workflow, /status=success/)
  assert.match(workflow, /\.head_sha != \$current/)
  assert.match(workflow, /github\.event\.pull_request\.base\.sha/)
  assert.match(workflow, /select\(\.head_sha == \$dev\)/)
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/)
  assert.match(workflow, /merge-base --is-ancestor "\$baseline" "\$GITHUB_SHA"/)
  assert.match(workflow, /MOMI_DEV_REF=\$baseline/)
  assert.match(workflow, /refs\/heads\/prod/)
  assert.match(workflow, /baseline="\$GITHUB_SHA"/)
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/)
})
