import assert from "node:assert/strict"
import test from "node:test"

import { syncRoadmap } from "../scripts/zenhub_roadmap_sync/sync_roadmap.ts"
import type { RoadmapContract } from "../scripts/zenhub_roadmap_sync/types.ts"

test("roadmap reconciliation repairs drift, verifies it, and is idempotent", async () => {
  const originalFetch = globalThis.fetch
  const contract: RoadmapContract = {
    schema_version: 1,
    initiative: { issue_number: 1, order: "00", title: "Roadmap" },
    projects: [
      { issue_number: 2, order: "01A", title: "Alpha" },
      { issue_number: 3, order: "01B", title: "Beta" },
    ],
  }
  const githubTitles = new Map([[1, "wrong"], [2, "01A · Alpha"], [3, "01B · Beta"]])
  const zenhub = new Map([
    [1, { id: "issue-1", issueType: { id: "wrong", name: "Task" }, parentIssue: null }],
    [2, { id: "issue-2", issueType: { id: "project-type", name: "Project" }, parentIssue: null }],
    [3, { id: "issue-3", issueType: null, parentIssue: { id: "other", number: 99 } }],
  ])
  const mutations: string[] = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.startsWith("https://api.github.com/")) {
      const issueNumber = Number(url.split("/").at(-1))
      if (init?.method === "PATCH") {
        const title = (JSON.parse(String(init.body)) as { title: string }).title
        githubTitles.set(issueNumber, title)
        mutations.push(`title:${issueNumber}`)
      }
      return Response.json({ number: issueNumber, title: githubTitles.get(issueNumber) })
    }
    const body = JSON.parse(String(init?.body)) as {
      query: string
      variables: Record<string, unknown>
    }
    if (body.query.includes("RoadmapRepository")) {
      return Response.json({ data: { workspace: { repositoriesConnection: { nodes: [
        { ghId: 123, id: "repository-id", name: "repository" },
      ] } } } })
    }
    if (body.query.includes("RoadmapIssueTypes")) {
      return Response.json({ data: { node: { assignableIssueTypes: { nodes: [
        { id: "initiative-type", name: "Initiative" },
        { id: "project-type", name: "Project" },
      ] } } } })
    }
    if (body.query.includes("query RoadmapIssue")) {
      const issueNumber = Number(body.variables.issueNumber)
      return Response.json({ data: { issueByInfo: { number: issueNumber, ...zenhub.get(issueNumber) } } })
    }
    if (body.query.includes("ChangeRoadmapIssueType")) {
      const change = body.variables.input as { issueIds: string[]; issueTypeId: string }
      for (const issue of zenhub.values()) {
        if (change.issueIds.includes(issue.id)) {
          issue.issueType = {
            id: change.issueTypeId,
            name: change.issueTypeId === "initiative-type" ? "Initiative" : "Project",
          }
        }
      }
      mutations.push(`types:${change.issueIds.join(",")}`)
      return Response.json({ data: { changeIssueTypeOfIssues: {
        failedIssues: [], githubErrors: [], successCount: change.issueIds.length,
      } } })
    }
    if (body.query.includes("ParentRoadmapIssues")) {
      const childIds = body.variables.childIssueIds as string[]
      for (const [number, issue] of zenhub) {
        if (childIds.includes(issue.id)) issue.parentIssue = { id: "issue-1", number: 1 }
        zenhub.set(number, issue)
      }
      mutations.push(`parents:${childIds.join(",")}`)
      return Response.json({ data: { addSubIssues: {
        failedIssues: [], successCount: childIds.length,
      } } })
    }
    return new Response("unexpected request", { status: 500 })
  }
  try {
    const input = {
      contract,
      githubRepository: "owner/repository",
      githubRepositoryId: 123,
      githubToken: "github-token",
      workspaceId: "workspace-id",
      zenhubToken: "zenhub-token",
    }
    assert.deepEqual(await syncRoadmap(input), {
      issues: 3, parents_repaired: 2, titles_repaired: 1, types_repaired: 2,
    })
    assert.deepEqual(await syncRoadmap(input), {
      issues: 3, parents_repaired: 0, titles_repaired: 0, types_repaired: 0,
    })
    assert.deepEqual(mutations, [
      "title:1", "types:issue-1", "types:issue-3", "parents:issue-2,issue-3",
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
