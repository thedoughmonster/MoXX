import assert from "node:assert/strict"
import test from "node:test"

import { buildContext } from "../scripts/issue_triage/build_context.ts"
import { loadTriageConfig } from
  "../scripts/issue_triage/load_triage_config.ts"
import { selectPendingIssue } from
  "../scripts/issue_triage/select_pending_issue.ts"

test("bounded context reports token estimates and fails above hard limit", () => {
  const config = loadTriageConfig()
  const measured = buildContext(
    { number: 136, title: "Triage", body: "x".repeat(100) },
    [],
    [{ number: 109, title: "Related issue" }],
    config,
  )
  assert.equal(measured.characters, measured.text.length)
  assert.equal(measured.estimatedTokens, Math.ceil(measured.text.length / 4))
  assert.equal(measured.softExceeded, false)
  assert.throws(() => buildContext(
    { number: 136, title: "Triage", body: "x".repeat(100) },
    [],
    [],
    {
      ...config,
      context: {
        ...config.context,
        soft_estimated_tokens: 1,
        hard_estimated_tokens: 2,
      },
    },
  ), /exceeds hard limit/)
})

test("declarations are parsed from the full body before prose truncation", () => {
  const config = loadTriageConfig()
  const marker = `<!-- momi-issue-relationships:v1
${JSON.stringify({
    schema_version: 1,
    issue_number: 200,
    relationships: [{
      issue_number: 199,
      type: "ordering_constraint",
      direction: "current_before_related",
      rationale: "This P0 slice lands before issue 199.",
    }],
  })}
-->`
  const classification = `<!-- momi-issue-classification:v1
${JSON.stringify({ schema_version: 1, issue_number: 200, issue_type: "feature" })}
-->`
  const measured = buildContext(
    {
      number: 200,
      title: "P0",
      body: `${"x".repeat(10_001)}${marker}${classification}`,
    },
    [],
    [],
    config,
  )
  const context = JSON.parse(measured.text)
  assert.equal(context.issue.body.length, 10_000)
  assert.equal(context.issue.body.includes(marker), false)
  assert.deepEqual(context.declared_relationships[0], {
    issue_number: 199,
    type: "ordering_constraint",
    direction: "current_before_related",
    rationale: "This P0 slice lands before issue 199.",
  })
  assert.equal(context.declared_issue_type, "feature")
})

test("catch-up selects the oldest issue with the pending label", async () => {
  const originalFetch = globalThis.fetch
  const originalToken = process.env.GH_TOKEN
  const originalRepository = process.env.GITHUB_REPOSITORY
  process.env.GH_TOKEN = "test-token"
  process.env.GITHUB_REPOSITORY = "owner/repository"
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes("/issues?")) {
      return new Response(JSON.stringify([
        { number: 168 },
      ]))
    }
    throw new Error(`Unexpected test request: ${url}`)
  }) as typeof fetch
  try {
    assert.equal(await selectPendingIssue(loadTriageConfig()), 168)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = originalToken
    if (originalRepository === undefined) delete process.env.GITHUB_REPOSITORY
    else process.env.GITHUB_REPOSITORY = originalRepository
  }
})
