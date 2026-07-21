import assert from "node:assert/strict"
import test from "node:test"

import { appendLogSelection } from "../src/append_log_selection.ts"
import { estimateProviderPayloadTokens } from "../src/provider_payload_policy.ts"
import { remainingDeadlineSeconds } from "../src/remaining_deadline_seconds.ts"
import { replayResponse } from "../src/replay_response.ts"
import { resolveLogSelection } from "../src/resolve_log_selection.ts"
import type { Admission, ChatInput } from "../src/types.ts"

const input = (content: string, momi_log?: ChatInput["momi_log"]): ChatInput => ({
  model: "momi-assistant",
  messages: [{ role: "user", content }],
  user: { id: "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", email: "user@example.com" },
  conversation_id: "conversation-1",
  turn_id: "turn-1",
  idempotency_key: "conversation-1:turn-1",
  ...(momi_log ? { momi_log } : {}),
})

test("accepts affirmative log intent and rejects negation or quotation", () => {
  assert.equal(resolveLogSelection(input("log this"))?.flag.scope, "turn")
  assert.equal(resolveLogSelection(input("please log this conversation."))?.flag.scope,
    "conversation")
  assert.equal(resolveLogSelection(input("do not log this")), null)
  assert.equal(resolveLogSelection(input('Explain the phrase "log this"')), null)
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

test("performs exactly one append for affirmative intent and none otherwise", async () => {
  let appends = 0
  const append = () => { appends += 1; return Promise.resolve({ disposition: "stored" }) }
  const context = { input: input("log this"), invocationId: "invocation-1",
    archiveReceiptId: "receipt-1" }
  await appendLogSelection(context.input, context, append)
  await appendLogSelection(input("do not log this"), context, append)
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
