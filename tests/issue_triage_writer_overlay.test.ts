import assert from "node:assert/strict"
import test from "node:test"

import { applyTriage } from "../scripts/issue_triage/apply_triage.ts"
import type { IssueTriage } from "../scripts/issue_triage/types.ts"

const stale: IssueTriage = {
  schema_version: 1,
  issue_number: 136,
  issue_type: "bug",
  feature: { id: "triage-authority", title: "Triage authority" },
  relationships: [{ issue_number: 109, type: "hard_prerequisite",
    direction: "current_after_related", rationale: "Issue 109 must land first." }],
  safe_parallel: false,
  confidence: "high",
  rationale: "The issue declares an ordering constraint.",
  labels: ["bug"],
}

test("writer overlays the latest body declaration over stale model output", async () => {
  const originalFetch = globalThis.fetch
  const original = {
    token: process.env.GH_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    number: process.env.TRIAGE_ISSUE_NUMBER,
    output: process.env.TRIAGE_OUTPUT,
  }
  process.env.GH_TOKEN = "test-token"
  process.env.GITHUB_REPOSITORY = "owner/repository"
  process.env.TRIAGE_ISSUE_NUMBER = "136"
  process.env.TRIAGE_OUTPUT = JSON.stringify(stale)
  let rendered = ""
  let appliedLabels: string[] = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.endsWith("/issues/136")) return new Response(JSON.stringify({
      number: 136,
      state: "open",
      labels: [
        { name: "enhancement" },
        { name: "area:platform" },
        { name: "triage:pending" },
      ],
      body: `<!-- momi-issue-relationships:v1\n${JSON.stringify({
        schema_version: 1,
        issue_number: 136,
        relationships: [{ issue_number: 109, type: "ordering_constraint",
          direction: "current_before_related",
          rationale: "Issue 136 lands before the remaining issue 109 work." }],
      })}\n-->`,
    }))
    if (url.endsWith("/issues/109")) return new Response(JSON.stringify({
      number: 109, state: "open", body: null, labels: [],
    }))
    if (url.endsWith("/labels/bug")) return new Response("{}")
    if (url.includes("/issues/136/comments?")) return new Response("[]")
    if (url.endsWith("/issues/136/comments") && init?.method === "POST") {
      rendered = JSON.parse(String(init.body)).body
      return new Response("{}")
    }
    if (url.endsWith("/issues/136/labels") && init?.method === "PUT") {
      appliedLabels = JSON.parse(String(init.body)).labels
      return new Response("{}")
    }
    throw new Error(`Unexpected test request: ${url}`)
  }) as typeof fetch
  try {
    await applyTriage()
    assert.match(rendered, /#109 - ordering_constraint; current_before_related;/)
    assert.match(rendered, /issuer-declared/)
    assert.doesNotMatch(rendered, /#109 - hard_prerequisite/)
    assert.deepEqual(appliedLabels, ["area:platform", "bug"])
  } finally {
    globalThis.fetch = originalFetch
    if (original.token === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = original.token
    if (original.repository === undefined) delete process.env.GITHUB_REPOSITORY
    else process.env.GITHUB_REPOSITORY = original.repository
    if (original.number === undefined) delete process.env.TRIAGE_ISSUE_NUMBER
    else process.env.TRIAGE_ISSUE_NUMBER = original.number
    if (original.output === undefined) delete process.env.TRIAGE_OUTPUT
    else process.env.TRIAGE_OUTPUT = original.output
  }
})
