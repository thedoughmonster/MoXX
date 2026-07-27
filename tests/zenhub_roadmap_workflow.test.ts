import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("the roadmap workflow repairs direct edits and out-of-band drift", async () => {
  const workflow = await readFile(".github/workflows/sync-zenhub-roadmap.yml", "utf8")
  assert.match(workflow, /issues:\n    types: \[edited\]/)
  assert.match(workflow, /push:\n    branches: \[prod\]/)
  assert.match(workflow, /schedule:\n    - cron: "43 3 \* \* \*"/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.match(workflow, /permissions:\n      contents: read\n      issues: write/)
  assert.doesNotMatch(workflow, /contents: write|pull_request_target/)
  assert.match(workflow, /secrets\.ZENHUB_API_TOKEN/)
  assert.match(workflow, /ZENHUB_ROADMAP_ISSUE_NUMBER: \$\{\{ github\.event\.issue\.number \}\}/)
  assert.match(workflow, /vars\.ZENHUB_WORKSPACE_ID/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /run_zenhub_roadmap_sync\.ts/)
})
