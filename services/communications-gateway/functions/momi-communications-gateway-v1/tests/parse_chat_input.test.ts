import assert from "node:assert/strict"
import test from "node:test"

import { parseChatInput } from "../src/parse_chat_input.ts"
import { resolveLogSelection } from "../src/resolve_log_selection.ts"

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

test("accepts model-visible tool history and resolves the explicit complete turn", () => {
  const messages = [
    { role: "user", content: "earlier question" },
    { role: "assistant", content: "earlier answer" },
    { role: "user", content: "current question" },
    { role: "assistant", content: "calling sales reader", tool_calls: [{
      id: "call-1", type: "function", function: { name: "read_sales", arguments: "{}" },
    }] },
    { role: "tool", content: "sales result", tool_call_id: "call-1" },
    { role: "assistant", content: "current answer" },
  ]
  const parsed = parseChatInput({ ...valid, messages, momi_log: { scope: "turn" } })
  assert.ok(parsed)
  const selection = resolveLogSelection(parsed)
  assert.deepEqual(selection?.flag, { scope: "turn" })
  assert.deepEqual(selection?.content.messages, messages.slice(2))
  assert.equal(selection?.content.selected_content,
    "current question\ncalling sales reader\nsales result\ncurrent answer")
})

test("rejects malformed tool history and additional message fields", () => {
  assert.equal(parseChatInput({ ...valid, messages: [{ role: "tool", content: "result" }] }), null)
  assert.equal(parseChatInput({ ...valid, messages: [{ role: "assistant", content: "call",
    tool_calls: [{ id: "call-1", type: "function",
      function: { name: "read_sales", arguments: "{}", authorization: "secret" } }] }] }), null)
  assert.equal(parseChatInput({ ...valid, messages: [{
    role: "user",
    content: "hello",
    name: "provider-control",
  }] }), null)
})

test("accepts only bounded explicit user-log selection metadata", () => {
  assert.ok(parseChatInput({ ...valid, momi_log: { scope: "turn", note: "log this" } }))
  assert.ok(parseChatInput({ ...valid, momi_log: { scope: "message",
    message_id: "message-1", selected_content: "selected" } }))
  assert.ok(parseChatInput({ ...valid, momi_log: { scope: "range",
    range: { start: 0, end: 8 }, selected_content: "selected" } }))
  assert.equal(parseChatInput({ ...valid, momi_log: { scope: "message" } }), null)
  assert.equal(parseChatInput({ ...valid, momi_log: {
    scope: "turn",
    selected_by: "model",
  } }), null)
})
