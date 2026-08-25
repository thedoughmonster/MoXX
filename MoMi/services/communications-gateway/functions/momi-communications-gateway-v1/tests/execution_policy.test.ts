import assert from "node:assert/strict"
import test from "node:test"

import { estimateProviderPayloadTokens } from "../src/provider_payload_policy.ts"
import { remainingDeadlineSeconds } from "../src/remaining_deadline_seconds.ts"
import { logIntentScope } from "../src/log_intent_scope.ts"
import { resolveLogSelection } from "../src/resolve_log_selection.ts"
import type { ChatInput } from "../src/types.ts"

const userId = "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123"
const source = {
  source_user_id: userId,
  source_conversation_id: "conversation-1",
}
const input = (content: string, momi_log?: ChatInput["momi_log"],
  messages?: ChatInput["messages"]): ChatInput => ({
  model: "momi-assistant",
  messages: messages ?? [{ role: "user", content }],
  user: { id: userId, email: "user@example.com" },
  conversation_id: "conversation-1",
  turn_id: "turn-1",
  idempotency_key: "conversation-1:turn-1",
  ...(momi_log ? { momi_log } : {}),
})

test("recognizes strict natural commands but never invents source identities", () => {
  const messages: ChatInput["messages"] = [
    { role: "system", content: "policy" }, { role: "user", content: "question" },
    { role: "assistant", content: "answer" }, { role: "user", content: "log this message" },
  ]
  assert.equal(logIntentScope(input("", undefined, messages)), "message")
  assert.equal(resolveLogSelection(input("", undefined, messages)), null)
  messages[3] = { role: "user", content: "log this turn" }
  assert.equal(logIntentScope(input("", undefined, messages)), "turn")
  assert.equal(resolveLogSelection(input("", undefined, messages)), null)
  messages[3] = { role: "user", content: "please log this conversation." }
  assert.equal(logIntentScope(input("", undefined, messages)), "conversation")
  assert.equal(resolveLogSelection(input("", undefined, messages)), null)
})

test("rejects commands without prior scope, negation, quotation, or latest position", () => {
  assert.equal(logIntentScope(input("log this")), "turn")
  assert.equal(logIntentScope(input("do not log this")), null)
  assert.equal(logIntentScope(input('Explain the phrase "log this"')), null)
  assert.equal(logIntentScope(input("maybe log this")), null)
  assert.equal(logIntentScope(input("", undefined, [
    { role: "user", content: "log this" }, { role: "assistant", content: "later" },
  ])), null)
})

test("maps exact @log and ordinary explicit phrases from configuration", () => {
  const history: ChatInput["messages"] = [
    { role: "user", content: "The checkout failed." },
    { role: "assistant", content: "I found the error." },
    { role: "user", content: "@log" },
  ]
  assert.equal(logIntentScope(input("", undefined, history)), "turn")
  history[2] = { role: "user", content: "Can you log this bug?" }
  assert.equal(logIntentScope(input("", undefined, history)), "turn")
  history[2] = { role: "user", content: "@log message" }
  assert.equal(logIntentScope(input("", undefined, history)), "message")
})

test("requires authenticated scope-specific explicit selections", () => {
  assert.equal(resolveLogSelection(input("anything", {
    ...source, scope: "message", message_id: "message-1",
    source_turn_id: "turn-1", selected_content: "chosen",
  }))?.content.selected_content, "chosen")
  assert.equal(resolveLogSelection(input("anything", {
    ...source, scope: "range", range: { start: 2, end: 9 },
    selected_content: "chosen",
  }))?.flag.scope, "range")
  assert.equal(resolveLogSelection(input("anything", {
    ...source, source_user_id: "00000000-0000-4000-8000-000000000002",
    scope: "conversation",
  })), null)
  assert.equal(resolveLogSelection(input("anything", {
    ...source, source_conversation_id: "other-conversation", scope: "conversation",
  })), null)
  assert.equal(resolveLogSelection(input("anything", {
    ...source, scope: "message", message_id: "message-1",
    source_turn_id: "other-turn", selected_content: "chosen",
  })), null)
  assert.equal(resolveLogSelection(input("anything", {
    ...source, scope: "turn", source_turn_id: "other-turn",
  })), null)
})

test("structured turn preserves the complete latest model-visible turn", () => {
  const messages: ChatInput["messages"] = [
    { role: "user", content: "earlier question" },
    { role: "assistant", content: "earlier answer" },
    { role: "user", content: "current question" },
    { role: "assistant", content: "calling sales reader", tool_calls: [{
      id: "call-1", type: "function", function: { name: "read_sales", arguments: "{}" },
    }] },
    { role: "tool", content: "sales result", tool_call_id: "call-1" },
    { role: "assistant", content: "current answer" },
  ]
  const selection = resolveLogSelection(input("", {
    ...source, scope: "turn", source_turn_id: "turn-1",
  }, messages))
  assert.deepEqual(selection?.content.messages, messages.slice(2))
  assert.equal(selection?.content.selected_content,
    "current question\ncalling sales reader\nsales result\ncurrent answer")
})

test("counts tool definitions and results in each complete provider payload", () => {
  const base = estimateProviderPayloadTokens({ model: "provider", messages: [] })
  const withTools = estimateProviderPayloadTokens({ model: "provider", messages: [],
    tools: [{ name: "read" }] })
  const withResults = estimateProviderPayloadTokens({ model: "provider",
    messages: [{ role: "tool", content: "x".repeat(4000) }],
    tools: [{ name: "read" }] })
  assert(withTools > base)
  assert(withResults > withTools)
})

test("enforces one whole-invocation deadline", () => {
  assert.equal(remainingDeadlineSeconds("2026-07-21T00:00:10.000Z",
    Date.parse("2026-07-21T00:00:00.000Z")), 10)
  assert.throws(() => remainingDeadlineSeconds("2026-07-21T00:00:00.000Z",
    Date.parse("2026-07-21T00:00:01.000Z")), /invocation_deadline_exceeded/)
})
