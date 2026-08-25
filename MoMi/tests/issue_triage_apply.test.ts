import assert from "node:assert/strict"
import test from "node:test"

import { applyTriage } from "../scripts/issue_triage/apply_triage.ts"
import type { IssueTriage } from "../scripts/issue_triage/types.ts"

const candidate: IssueTriage = {
  schema_version: 1,
  issue_number: 136,
  issue_type: "feature",
  feature: { id: "issue-triage", title: "Automated issue triage" },
  relationships: [{ issue_number: 109, type: "independent",
    direction: "not_applicable", rationale: "Issue 109 is related." }],
  safe_parallel: true,
  confidence: "high",
  rationale: "The issue has one related issue.",
  labels: ["enhancement"],
}

test("writer rejects missing, closed, and pull-request references before writes", async () => {
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
  process.env.TRIAGE_OUTPUT = JSON.stringify(candidate)
  try {
    for (const kind of ["missing", "closed", "pull-request"] as const) {
      let mutated = false
      globalThis.fetch = (async (input, init) => {
        if (init?.method && init.method !== "GET") mutated = true
        const url = String(input)
        if (url.endsWith("/issues/136")) return new Response(JSON.stringify({
          number: 136, state: "open", body: null, labels: [],
        }))
        if (url.endsWith("/issues/109")) {
          if (kind === "missing") return new Response("", { status: 404 })
          return new Response(JSON.stringify({
            number: 109,
            state: kind === "closed" ? "closed" : "open",
            body: null,
            labels: [],
            ...(kind === "pull-request" ? { pull_request: {} } : {}),
          }))
        }
        throw new Error(`Unexpected test request: ${url}`)
      }) as typeof fetch
      await assert.rejects(() => applyTriage())
      assert.equal(mutated, false)
    }
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
