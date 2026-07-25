import assert from "node:assert/strict"
import test from "node:test"

import { callProvider } from "../src/call_provider.ts"

test("uses only the communications gateway credential", async () => {
  const originalDeno = globalThis.Deno
  const requested: Record<string, unknown> = {}
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: {
    env: { get: (name: string) => name === "MOMI_MODEL_EXECUTION_GATEWAY_URL"
      ? "https://gateway.test" : name === "MOMI_MODEL_GATEWAY_COMMUNICATIONS_SECRET"
      ? "test-secret" : undefined },
  } })
  try {
    const result = await callProvider("communications.answer", "standard",
      "turn-1", "turn-1:answer:1", { input: [] }, 4000, false,
      new Date(Date.now() + 5000).toISOString(), (_url, init) => {
        requested.authorization = new Headers(init?.headers).get("authorization")
        requested.body = JSON.parse(String(init?.body))
        return Promise.resolve(new Response(JSON.stringify({ ok: true,
          ambiguous: false, status: 200, body: { output: [] }, duration_ms: 1,
          call_id: "call-1", provider_model: "mapped-model" }), { status: 200 }))
      })
    assert.equal(result.ok, true)
    assert.equal(requested.authorization, "Bearer test-secret")
    assert.equal((requested.body as Record<string, unknown>).purpose_key,
      "communications.answer")
    assert.doesNotMatch(JSON.stringify(requested.body), /api\.openai\.com|OPENAI_API_KEY/)
  } finally {
    Object.defineProperty(globalThis, "Deno", { configurable: true, value: originalDeno })
  }
})
