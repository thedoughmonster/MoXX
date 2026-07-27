import assert from "node:assert/strict"
import test from "node:test"

import { getGitHubIssues } from "../scripts/zenhub_pipeline_sync/github_issues.ts"
import { syncIssue } from "../scripts/zenhub_pipeline_sync/sync_issue.ts"

test("bulk issue discovery excludes pull requests", async () => {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = async (input) => {
    requests.push(String(input))
    return new Response(JSON.stringify([
      { id: 1, labels: [], number: 10, state: "closed" },
      { id: 2, labels: [], number: 11, pull_request: { url: "example" }, state: "open" },
    ]), { status: 200 })
  }
  try {
    const issues = await getGitHubIssues("test-token", "owner/repository")
    assert.deepEqual(issues.map((issue) => issue.number), [10])
    assert.match(requests[0] ?? "", /state=all/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("missing status defaults to deferred before reconciliation", async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ body: unknown; url: string }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ body: init?.body, url: String(input) })
    if (requests.length === 1) return new Response("[]", { status: 200 })
    return new Response(JSON.stringify({
      data: {
        issueByInfo: {
          id: "issue-id",
          pipelineIssue: { pipeline: { id: "todo-id", name: "Todo" } },
        },
      },
    }), { status: 200 })
  }
  try {
    const result = await syncIssue({
      defaultLabel: "status:deferred",
      githubIssue: { id: 1, labels: ["enhancement"], number: 10, state: "open" },
      githubToken: "github-token",
      pipelineMap: { "status:deferred": "todo-id" },
      repository: "owner/repository",
      repositoryGhId: 123,
      workspaceId: "workspace-id",
      zenhubToken: "zenhub-token",
    })
    assert.match(result, /Defaulted to status:deferred/)
    assert.match(requests[0]?.url ?? "", /issues\/10\/labels$/)
    assert.equal(requests[0]?.body, '{"labels":["status:deferred"]}')
    assert.equal(requests.length, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("closed issues shed planning labels without a Zenhub request", async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ method: string; url: string }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ method: init?.method ?? "GET", url: String(input) })
    return new Response("[]", { status: 200 })
  }
  try {
    const result = await syncIssue({
      defaultLabel: "status:deferred",
      githubIssue: {
        id: 1,
        labels: ["enhancement", "status:next", "status:blocked"],
        number: 10,
        state: "closed",
      },
      githubToken: "github-token",
      pipelineMap: { "status:deferred": "todo-id" },
      repository: "owner/repository",
      repositoryGhId: 123,
      workspaceId: "workspace-id",
      zenhubToken: "zenhub-token",
    })
    assert.match(result, /Removed status:next, status:blocked/)
    assert.deepEqual(requests, [
      {
        method: "DELETE",
        url: "https://api.github.com/repos/owner/repository/issues/10/labels/status%3Anext",
      },
      {
        method: "DELETE",
        url: "https://api.github.com/repos/owner/repository/issues/10/labels/status%3Ablocked",
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
