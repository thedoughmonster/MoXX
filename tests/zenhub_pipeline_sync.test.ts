import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { selectPipeline } from "../scripts/zenhub_pipeline_sync/select_pipeline.ts"
import { zenhubGraphQL } from "../scripts/zenhub_pipeline_sync/zenhub_graphql.ts"

const map = {
  "status:active": "doing-id",
  "status:blocked": "todo-id",
  "status:deferred": "todo-id",
  "status:next": "todo-id",
}

test("selects the pipeline owned by the status label", () => {
  assert.deepEqual(selectPipeline(["bug", "status:active"], map), {
    label: "status:active",
    pipelineId: "doing-id",
  })
})

test("finds no configured pipeline without a managed status label", () => {
  assert.equal(selectPipeline(["bug", "priority:p1"], map), null)
})

test("rejects ambiguous managed status labels", () => {
  assert.throws(
    () => selectPipeline(["status:next", "status:active"], map),
    /Multiple managed status labels found: status:next, status:active/,
  )
})

test("rejects unknown status labels instead of silently defaulting", () => {
  assert.throws(
    () => selectPipeline(["status:typo"], map),
    /Unknown status labels found: status:typo/,
  )
})

test("rejects GraphQL errors returned with HTTP 200", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ errors: [{ message: "move rejected" }] }), {
      status: 200,
    })
  try {
    await assert.rejects(
      zenhubGraphQL("test-token", "mutation Test { test }", {}),
      /Zenhub GraphQL failed: move rejected/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("workflow reconciles drift and keeps configuration external", async () => {
  const workflow = await readFile(".github/workflows/sync-zenhub-pipeline.yml", "utf8")
  assert.match(workflow, /issues:\n    types: \[opened, labeled, unlabeled, reopened\]/)
  assert.match(workflow, /schedule:\n    - cron: "17 3 \* \* \*"/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /required: false/)
  assert.match(workflow, /permissions:\n      contents: read\n      issues: write/)
  assert.doesNotMatch(workflow, /contents: write|pull_request_target/)
  assert.match(workflow, /secrets\.ZENHUB_API_TOKEN/)
  assert.match(workflow, /vars\.ZENHUB_DEFAULT_STATUS_LABEL/)
  assert.match(workflow, /vars\.ZENHUB_PIPELINE_MAP/)
  assert.match(workflow, /vars\.ZENHUB_WORKSPACE_ID/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /run_zenhub_pipeline_sync\.ts/)
})
