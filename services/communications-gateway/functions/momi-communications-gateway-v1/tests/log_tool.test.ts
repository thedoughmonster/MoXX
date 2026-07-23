import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { logChatResponse } from "../src/log_chat_response.ts"
import { logReceipt } from "../src/log_receipt.ts"
import { logReplayResponse } from "../src/log_replay_response.ts"
import { toolDefinitions } from "../src/tool_definitions.ts"

test("keeps logging out of model-owned tool selection", () => {
  assert.equal(toolDefinitions.some((tool) =>
    tool.function.name === "create_momi_log"), false)
})

test("validates the operations-owner receipt and renders visible success", () => {
  const receipt = logReceipt({ disposition: "stored",
    selection_id: "selection-1", shop_log_id: "log-1" })
  assert.deepEqual(receipt, { disposition: "stored",
    selection_id: "selection-1", shop_log_id: "log-1" })
  assert.equal(logReceipt({ error: "failed" }), null)
  const response = logChatResponse({ id: "invocation-1", object: "momi.log",
    model: "momi-assistant", status: "completed", ...receipt! })
  assert.equal(response.body.choices[0].message.content, "Logged to MoMi.")
})

test("replays only a zero-provider durable log receipt", () => {
  const terminal = { id: "invocation-1", object: "momi.log",
    model: "momi-assistant", status: "completed", disposition: "duplicate",
    selection_id: "selection-1", shop_log_id: "log-1" }
  assert.deepEqual(logReplayResponse("invocation-1", {
    invocation_status: "completed", error_code: null,
    terminal_response: terminal, provider_calls: 0,
  }), { status: 200, body: terminal })
  assert.throws(() => logReplayResponse("invocation-1", {
    invocation_status: "completed", error_code: null,
    terminal_response: terminal, provider_calls: 1,
  }), /log_replay_invalid/)
})

test("short-circuits explicit logging before provider setup", async () => {
  const source = await readFile(new URL("../src/process_chat.ts", import.meta.url), "utf8")
  const selection = source.indexOf("const logSelection = resolveLogSelection(input)")
  const logging = source.indexOf("await processLog(input, logSelection)")
  const provider = source.indexOf("const tools = JSON.parse")
  assert(selection >= 0 && selection < logging && logging < provider)
})
