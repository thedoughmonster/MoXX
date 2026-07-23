import assert from "node:assert/strict"
import test from "node:test"

import { callProvider } from "../src/call_provider.ts"

test("reuses the existing provider secret without exposing it", async () => {
  const originalDeno = globalThis.Deno
  const requested: Record<string, unknown> = {}
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: {
    env: { get: (name: string) => name === "OPENAI_API_KEY" ? "test-secret" : undefined },
  } })
  try {
    const result = await callProvider("https://api.openai.com/v1/chat/completions",
      { model: "gpt-5.6-terra", messages: [] }, 5, (_url, init) => {
        requested.authorization = new Headers(init?.headers).get("authorization")
        return Promise.resolve(new Response(JSON.stringify({ choices: [] }), { status: 200 }))
      })
    assert.equal(result.ok, true)
    assert.equal(requested.authorization, "Bearer test-secret")
  } finally {
    Object.defineProperty(globalThis, "Deno", { configurable: true, value: originalDeno })
  }
})
