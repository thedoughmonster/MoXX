import assert from "node:assert/strict"
import test from "node:test"

import { replayResponse } from "../src/replay_response.ts"
import type { InvocationReplay } from "../src/types.ts"

const id = "5abea48d-d28f-46f1-ab06-084153264ab1"
const body = { id, object: "chat.completion", model: "momi-assistant",
  choices: [{ index: 0, message: { role: "assistant", content: "durable answer" },
    finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 4 } }
const replay = (status: string,
  terminalResponse: InvocationReplay["terminal_response"] = null): InvocationReplay => ({
  invocation_status: status, error_code: null,
  terminal_response: terminalResponse, provider_calls: 2,
})

test("returns the exact durable completed response", () => {
  const response = replayResponse(id, replay("completed", body))
  assert.equal(response.status, 200)
  assert.strictEqual(response.body, body)
  assert.equal(response.body.choices?.[0]?.message?.content, "durable answer")
})

test("failed and paid ambiguous replays are never HTTP 200", () => {
  for (const status of ["failed", "paid_ambiguous"]) {
    const response = replayResponse(id, replay(status))
    assert.equal(response.status, 502)
    assert.equal(response.body.status, status)
  }
})

test("in-flight replays are visibly pending and never HTTP 200", () => {
  for (const status of ["pending_archive", "admitted", "provider_started"]) {
    const response = replayResponse(id, replay(status))
    assert.equal(response.status, 409)
    assert.equal(response.body.error, "request_in_progress")
  }
})

test("missing, corrupt, and mismatched completed replay fails closed", () => {
  assert.throws(() => replayResponse(id, replay("completed")))
  assert.throws(() => replayResponse(id, replay("completed",
    { ...body, id: "another-invocation" })))
  assert.throws(() => replayResponse(id, replay("completed",
    { ...body, choices: [] })))
  assert.throws(() => replayResponse(id, replay("completed",
    { ...body, choices: [{ message: { role: "assistant", content: "" } }] })))
})
