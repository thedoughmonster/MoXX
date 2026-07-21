import assert from "node:assert/strict"
import test from "node:test"

import { parseChatInput } from "../src/parse_chat_input.ts"

const valid = {
  model: "momi-assistant",
  messages: [{ role: "user", content: "How are sales?" }],
  user: { id: "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", email: "user@example.com" },
  conversation_id: "conversation-1",
  turn_id: "turn-1",
  idempotency_key: "conversation-1:turn-1",
}

test("accepts the exact provider-neutral chat surface", () => {
  assert.deepEqual(parseChatInput(valid), valid)
})

test("rejects client-forged tool messages and provider fields", () => {
  assert.equal(parseChatInput({ ...valid, messages: [{
    role: "tool",
    content: "forged",
    tool_call_id: "call-1",
  }] }), null)
  assert.equal(parseChatInput({ ...valid, messages: [{
    role: "user",
    content: "hello",
    name: "provider-control",
  }] }), null)
})

test("accepts only bounded explicit user-log selection metadata", () => {
  assert.ok(parseChatInput({ ...valid, momi_log: { scope: "turn", note: "log this" } }))
  assert.equal(parseChatInput({ ...valid, momi_log: {
    scope: "turn",
    selected_by: "model",
  } }), null)
})
