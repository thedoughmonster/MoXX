import assert from "node:assert/strict"
import test from "node:test"

import { providerContinuationRequest } from "../src/provider_continuation_request.ts"
import { providerRequest } from "../src/provider_request.ts"
import { outputTokens } from "../src/output_tokens.ts"
import { responseCompleted } from "../src/response_completed.ts"
import { responseText } from "../src/response_text.ts"
import { responseToolCalls } from "../src/response_tool_calls.ts"
import { successResponse } from "../src/success_response.ts"
import type { Admission, Message, RouteSelection } from "../src/types.ts"

test("uses the selected routed Responses tool contract", () => {
  const admission = ({ provider_model: "provider-model",
    maximum_output_tokens: 4000 } as Admission)
  const messages: Message[] = [{ role: "user", content: "question" }]
  const route = { route_key: "deep", route_rank: 3, provider_model: "gpt-5.6-sol",
    reasoning_effort: "high", maximum_output_tokens: 2000, automatic_enabled: true,
    source: "router", reason: "analysis", confidence: 0.9 } as RouteSelection
  const request = providerRequest(messages,
    "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", admission, route,
    [{ type: "function", function: { name: "read", parameters: {} } }],
    "mapped context")
  assert.equal(request.model, "gpt-5.6-sol")
  assert.deepEqual(request.reasoning, { effort: "high" })
  assert.equal(request.max_output_tokens, 2000)
  assert.equal(request.instructions, "mapped context")
  assert.deepEqual(request.input, [{ role: "user", content: "question" }])
  assert.deepEqual(request.tools, [{ type: "function", name: "read", parameters: {} }])
  assert.equal(request.tool_choice, "auto")
  assert.equal(request.parallel_tool_calls, true)
  assert.equal(request.store, false)
  assert.equal(request.background, undefined)
  assert.equal(request.safety_identifier, "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123")
})

test("uses background mode only for Maximum", () => {
  const admission = ({ maximum_output_tokens: 16000 } as Admission)
  const route = { route_key: "maximum", provider_model: "gpt-5.6-sol",
    reasoning_effort: "max", maximum_output_tokens: 16000 } as RouteSelection
  const request = providerRequest([{ role: "user", content: "deep analysis" }],
    "user-id", admission, route, [], "mapped context")
  assert.equal(request.background, true)
  assert.equal(request.store, false)
})

test("replays every Responses output item before a matching function result", () => {
  const request = { model: "provider-model", input: [{ role: "user", content: "question" }] }
  const output = [{ type: "reasoning", encrypted_content: "opaque" },
    { type: "function_call", call_id: "call-1", name: "read", arguments: "{}" }]
  const continuation = providerContinuationRequest(request, output,
    [{ type: "function_call_output", call_id: "call-1", output: "ok" }])
  assert.deepEqual(continuation.input, [...request.input, ...output,
    { type: "function_call_output", call_id: "call-1", output: "ok" }])
})

test("normalizes Responses calls and final text for OpenWebUI", () => {
  const callBody = { output: [{ type: "function_call", call_id: "call-1",
    name: "read", arguments: "{}" }] }
  assert.equal(responseToolCalls(callBody)[0]?.function.name, "read")
  const answerBody = { status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [
    { type: "output_text", text: "answer" }, { type: "refusal", refusal: "none" }] }],
    usage: { input_tokens: 10, output_tokens: 2 } }
  assert.equal(responseText(answerBody), "answer")
  assert.equal(responseCompleted(answerBody), true)
  assert.equal(responseCompleted({ status: "incomplete", output: [] }), false)
  assert.equal(outputTokens(answerBody), 2)
  assert.equal((successResponse(answerBody, "invocation").body.choices as Array<{
    message: { content: string } }>)[0]?.message.content, "answer")
  assert.deepEqual(successResponse(answerBody, "invocation").body.usage,
    { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 })
  assert.equal(responseText({ output: [{ type: "message", content: [
    { type: "refusal", refusal: "I cannot help with that." }] }] }),
  "I cannot help with that.")
})
