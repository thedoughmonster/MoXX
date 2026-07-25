import assert from "node:assert/strict"
import test from "node:test"

import { waitForBackgroundResponse } from "../src/wait_for_background_response.ts"

test("polls one Maximum response without another model POST", async () => {
  const originalDeno = globalThis.Deno
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: {
    env: { get: (name: string) => name === "MOMI_MODEL_EXECUTION_GATEWAY_URL"
      ? "https://gateway.test" : "test-secret" },
  } })
  const methods: string[] = []
  const operations: string[] = []
  const responses = [
    { id: "resp_1", status: "in_progress", output: [] },
    { id: "resp_1", status: "completed", output: [] },
  ]
  try {
    const result = await waitForBackgroundResponse(
      { ok: true, ambiguous: false, status: 200,
        body: { id: "resp_1", status: "queued" }, duration_ms: 1,
        gateway_call_id: "00000000-0000-4000-8000-000000000001",
        provider_model: "mapped-model" },
      new Date(Date.now() + 5000).toISOString(),
      (_url, init) => {
        methods.push(init?.method ?? "GET")
        operations.push((JSON.parse(String(init?.body)) as { operation: string }).operation)
        return Promise.resolve(new Response(JSON.stringify({ ok: true,
          ambiguous: false, status: 200, body: responses.shift(), duration_ms: 1,
          provider_model: "mapped-model" }), { status: 200 }))
      },
      0,
    )
    assert.equal(result.result.body.status, "completed")
    assert.deepEqual(methods, ["POST", "POST"])
    assert.deepEqual(operations, ["retrieve", "retrieve"])
    assert.equal(result.observations.length, 3)
  } finally {
    Object.defineProperty(globalThis, "Deno",
      { configurable: true, value: originalDeno })
  }
})

test("Maximum deadline is visible without a hidden second attempt", async () => {
  let calls = 0
  const result = await waitForBackgroundResponse(
    { ok: true, ambiguous: false, status: 200,
      body: { id: "resp_1", status: "queued" }, duration_ms: 1,
      gateway_call_id: "00000000-0000-4000-8000-000000000001",
      provider_model: "mapped-model" },
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
