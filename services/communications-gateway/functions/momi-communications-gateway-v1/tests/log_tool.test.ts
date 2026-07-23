import assert from "node:assert/strict"
import test from "node:test"

import { appendLogSelection } from "../src/append_log_selection.ts"
import { resolveLogSelection } from "../src/resolve_log_selection.ts"
import { runMomiLogTool } from "../src/run_momi_log_tool.ts"
import { toolDefinitions } from "../src/tool_definitions.ts"
import type { ChatInput } from "../src/types.ts"

test("exposes a strict log tool gated by the resolved user-flag identity", async () => {
  const definition = toolDefinitions.find((tool) => tool.function.name === "create_momi_log")
  assert.deepEqual(definition?.function.parameters, { type: "object",
    additionalProperties: false, required: [], properties: {} })
  const input: ChatInput = { model: "momi-assistant", messages: [
    { role: "assistant", content: "selected" },
    { role: "user", content: "log this message" },
  ], user: { id: "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", email: "user@example.com" },
  conversation_id: "conversation-1", turn_id: "turn-1",
  idempotency_key: "conversation-1:turn-1" }
  const selection = resolveLogSelection(input)
  const context = { input, invocationId: "invocation-1",
    archiveReceiptId: "receipt-1", logSelection: selection }
  const identities = new Set<string>()
  let attempts = 0
  const append = (_flag: unknown, _content: unknown, toolContext: typeof context) => {
    attempts += 1
    identities.add(`${toolContext.input.idempotency_key}:user-flag`)
    return Promise.resolve({ disposition: attempts === 1 ? "stored" : "duplicate" })
  }
  await appendLogSelection(selection, context, append)
  await runMomiLogTool({}, context, append)
  assert.equal(attempts, 2)
  assert.equal(identities.size, 1)
  assert.deepEqual(await runMomiLogTool({}, { ...context, logSelection: null }, append),
    { error: "explicit_user_flag_required" })
  assert.deepEqual(await runMomiLogTool({ scope: "message" }, context, append),
    { error: "invalid_tool_arguments" })
})
