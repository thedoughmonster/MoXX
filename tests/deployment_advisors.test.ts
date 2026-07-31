import assert from "node:assert/strict"
import test from "node:test"

import { readAdvisor } from "../scripts/deploy/read_advisor.ts"

test("reads schema-valid advisor results", async () => {
  const lints = [{ name: "demo" }]
  const result = await readAdvisor("project", "security", async () =>
    Response.json({ lints }))
  assert.deepEqual(result, lints)
})

test("retries one transient advisor response", async () => {
  let calls = 0
  const result = await readAdvisor("project", "performance", async () => {
    calls += 1
    if (calls === 1) {
      return new Response("busy", {
        status: 429,
        headers: { "retry-after": "0" },
      })
    }
    return Response.json({ lints: [] })
  })
  assert.deepEqual(result, [])
  assert.equal(calls, 2)
})

test("identifies the failed advisor without exposing its body", async () => {
  let calls = 0
  await assert.rejects(
    readAdvisor("project", "security", async () => {
      calls += 1
      return new Response("credential-shaped-provider-detail", { status: 403 })
    }),
    (error: Error) => {
      assert.equal(
        error.message,
        "Unable to read Supabase security advisors (HTTP 403)",
      )
      assert.doesNotMatch(error.message, /credential-shaped-provider-detail/)
      return true
    },
  )
  assert.equal(calls, 1)
})

test("fails closed on an invalid advisor response contract", async () => {
  await assert.rejects(
    readAdvisor("project", "performance", async () => Response.json({ results: [] })),
    /Invalid Supabase performance advisors response \(lints\)/,
  )
})

test("masks transport details after one bounded retry", async () => {
  let calls = 0
  await assert.rejects(
    readAdvisor("project", "security", async () => {
      calls += 1
      throw new Error("credential-shaped-transport-detail")
    }),
    (error: Error) => {
      assert.equal(
        error.message,
        "Unable to read Supabase security advisors (transport error)",
      )
      assert.doesNotMatch(error.message, /credential-shaped-transport-detail/)
      return true
    },
  )
  assert.equal(calls, 2)
})
