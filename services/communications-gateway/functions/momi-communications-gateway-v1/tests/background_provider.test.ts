import assert from "node:assert/strict"
import test from "node:test"

import { waitForBackgroundResponse } from "../src/wait_for_background_response.ts"

test("polls one Maximum response without another model POST", async () => {
  const originalDeno = globalThis.Deno
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: {
    env: { get: () => "test-secret" },
  } })
  const methods: string[] = []
  const responses = [
    { id: "resp_1", status: "in_progress", output: [] },
    { id: "resp_1", status: "completed", output: [] },
  ]
  try {
    const result = await waitForBackgroundResponse(
      "https://api.openai.com/v1/responses",
      { ok: true, ambiguous: false, status: 200,
        body: { id: "resp_1", status: "queued" }, duration_ms: 1 },
      new Date(Date.now() + 5000).toISOString(),
      (_url, init) => {
        methods.push(init?.method ?? "GET")
        return Promise.resolve(new Response(JSON.stringify(responses.shift()),
          { status: 200 }))
      },
      0,
    )
    assert.equal(result.result.body.status, "completed")
    assert.deepEqual(methods, ["GET", "GET"])
    assert.equal(result.observations.length, 3)
  } finally {
    Object.defineProperty(globalThis, "Deno",
      { configurable: true, value: originalDeno })
  }
})

test("Maximum deadline is visible without a hidden second attempt", async () => {
  let calls = 0
  const result = await waitForBackgroundResponse(
    "https://api.openai.com/v1/responses",
    { ok: true, ambiguous: false, status: 200,
      body: { id: "resp_1", status: "queued" }, duration_ms: 1 },
    new Date(Date.now() - 1).toISOString(),
    () => {
      calls += 1
      return Promise.reject(new Error("must not poll"))
    },
    0,
  )
  assert.equal(calls, 0)
  assert.equal(result.result.ambiguous, false)
  assert.deepEqual(result.result.body,
    { error: { type: "provider_background_deadline_exceeded" } })
})
