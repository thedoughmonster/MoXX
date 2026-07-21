import assert from "node:assert/strict"
import test from "node:test"

import { appendLogSelection } from "../src/append_log_selection.ts"
import { estimateProviderPayloadTokens } from "../src/provider_payload_policy.ts"
import { remainingDeadlineSeconds } from "../src/remaining_deadline_seconds.ts"
import { replayResponse } from "../src/replay_response.ts"
import { resolveLogSelection } from "../src/resolve_log_selection.ts"
import type { Admission, ChatInput } from "../src/types.ts"

const input = (content: string, momi_log?: ChatInput["momi_log"],
  messages?: ChatInput["messages"]): ChatInput => ({
  model: "momi-assistant",
  messages: messages ?? [{ role: "user", content }],
  user: { id: "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", email: "user@example.com" },
  conversation_id: "conversation-1",
  turn_id: "turn-1",
  idempotency_key: "conversation-1:turn-1",
  ...(momi_log ? { momi_log } : {}),
})

test("resolves strict message, turn, and conversation commands without command text", () => {
  const messages: ChatInput["messages"] = [
    { role: "system", content: "policy" }, { role: "user", content: "question" },
    { role: "assistant", content: "answer" }, { role: "user", content: "log this message" },
  ]
  const message = resolveLogSelection(input("", undefined, messages))
  assert.equal(message?.flag.scope, "message")
  assert.equal(message?.flag.message_id, "conversation-1:model-visible-message:2")
  assert.equal(message?.content.selected_content, "answer")
  messages[3] = { role: "user", content: "log this turn" }
  const turn = resolveLogSelection(input("", undefined, messages))
  assert.deepEqual(turn?.content.messages, messages.slice(1, 3))
  assert.equal(turn?.content.selected_content, "question\nanswer")
  messages[3] = { role: "user", content: "please log this conversation." }
  assert.deepEqual(resolveLogSelection(input("", undefined, messages))?.content.messages,
    messages.slice(0, 3))
})

test("rejects commands without prior scope, negation, quotation, or latest position", () => {
  assert.equal(resolveLogSelection(input("log this")), null)
  assert.equal(resolveLogSelection(input("do not log this")), null)
  assert.equal(resolveLogSelection(input('Explain the phrase "log this"')), null)
  assert.equal(resolveLogSelection(input("", undefined, [
    { role: "user", content: "log this" }, { role: "assistant", content: "later" },
  ])), null)
})

test("requires scope-specific explicit selections", () => {
  assert.equal(resolveLogSelection(input("anything", {
    scope: "message", message_id: "message-1", selected_content: "chosen",
  }))?.content.selected_content, "chosen")
  assert.equal(resolveLogSelection(input("anything", { scope: "message" })), null)
  assert.equal(resolveLogSelection(input("anything", {
    scope: "range", range: { start: 2, end: 9 }, selected_content: "chosen",
  }))?.flag.scope, "range")
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
  const selection = resolveLogSelection(input("", { scope: "turn" }, messages))
  assert.deepEqual(selection?.content.messages, messages.slice(2))
  assert.equal(selection?.content.selected_content,
    "current question\ncalling sales reader\nsales result\ncurrent answer")
})

test("performs exactly one append for affirmative intent and none otherwise", async () => {
  let appends = 0
  const append = () => { appends += 1; return Promise.resolve({ disposition: "stored" }) }
  const selectedInput = input("", undefined, [
    { role: "user", content: "question" }, { role: "assistant", content: "selected" },
    { role: "user", content: "log this" },
  ])
  const selection = resolveLogSelection(selectedInput)
  const context = { input: selectedInput, invocationId: "invocation-1",
    archiveReceiptId: "receipt-1", logSelection: selection }
  await appendLogSelection(selection, context, append)
  await appendLogSelection(null, context, append)
  assert.equal(appends, 1)
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

test("returns only redacted terminal replay state", () => {
  const admission = ({ disposition: "duplicate", invocation_id: "invocation-1",
    invocation_status: "paid_ambiguous", error_code: "provider_transport_ambiguous" } as Admission)
  assert.deepEqual(replayResponse(admission), { status: 200, body: {
    id: "invocation-1", object: "momi.execution", model: "momi-assistant",
    status: "paid_ambiguous", replay: true, error: "request_failed",
  } })
})
