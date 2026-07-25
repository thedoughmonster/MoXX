import type { JSONValue } from "postgres"
import { asyncRequestDeadline } from "./async_request_deadline.ts"
import { authorizeProviderRound } from "./mark_provider_started.ts"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import type { AsyncRound } from "./async_round.ts"
import { claimAsyncRound } from "./claim_async_round.ts"
import { continueAsyncRound } from "./continue_async_round.ts"
import { finishAsyncRound } from "./finish_async_round.ts"
import { retryAsyncRound } from "./retry_async_round.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { outputTokens } from "./output_tokens.ts"
import { parseChatInput } from "./parse_chat_input.ts"
import { providerContinuationRequest } from "./provider_continuation_request.ts"
import { providerResponseId } from "./provider_response_id.ts"
import { responseCompleted } from "./response_completed.ts"
import { responseItems } from "./response_items.ts"
import { responseText } from "./response_text.ts"
import { responseToolCalls } from "./response_tool_calls.ts"
import { retrieveProviderResponse } from "./retrieve_provider_response.ts"
import { runToolCall } from "./run_tool_call.ts"
import { successResponse } from "./success_response.ts"
import { usage } from "./provider_usage.ts"

const visibleFailure = "MoMi could not complete this background request. Please try again."

export async function resumeAsyncRound(callId: string, responseId: string): Promise<{
  status: number; disposition: string
}> {
  let round = await claimAsyncRound(callId, responseId)
  if (!round) return { status: 409, disposition: "not_ready_or_duplicate" }
  const input = parseChatInput(round.input_payload)
  if (!input) {
    await retryAsyncRound(round, "stored_input_invalid")
    return { status: 503, disposition: "retrying" }
  }
  while (true) {
    const result = await retrieveProviderResponse(callId, responseId,
      asyncRequestDeadline(round.async_deadline))
    if (result.body.status === "queued" || result.body.status === "in_progress") {
      await retryAsyncRound(round, "provider_response_pending")
      return { status: 503, disposition: "retrying" }
    }
    const toolCalls = responseToolCalls(result.body)
    const completed = responseCompleted(result.body)
    const hasText = Boolean(responseText(result.body))
    const terminal = result.ambiguous ? "paid_ambiguous"
      : !result.ok || !completed || (!toolCalls.length && !hasText) ? "failed"
      : toolCalls.length ? "tool_pending" : "completed"
    const receipt = await captureEvidence(input, round.invocation_id,
      round.evidence_order + 1, `provider_round_${round.answer_round}_completed`,
      { provider_request: round.request_payload, provider_response: result.body,
        provider_observations: [{ source: "durable_completion" }] },
      "openai", result.provider_model, terminal, usage(result.body),
      { duration_ms: result.duration_ms, http_status: result.status })
    if (result.ambiguous || !result.ok || !completed || !toolCalls.length) {
      const state = terminal === "completed" ? "completed"
        : result.ambiguous ? "paid_ambiguous" : "failed"
      const response = state === "completed"
        ? successResponse(result.body, round.invocation_id)
        : null
      await finishAsyncRound(round, { status: state,
        terminal_receipt: receipt.archive_item_id,
        output_tokens: outputTokens(result.body),
        error_code: state === "completed" ? null : "background_provider_failed",
        terminal_response: response?.body ?? null,
        visible_content: response ? responseText(result.body) : visibleFailure })
      return { status: 200, disposition: state }
    }

    const toolContext = { input, invocationId: round.invocation_id,
      archiveReceiptId: round.archive_receipt_id }
    const toolOutputs: JSONValue[] = []
    for (const call of toolCalls) {
      const toolResult = await runToolCall(call, toolContext)
      toolOutputs.push({ type: "function_call_output", call_id: call.id,
        output: JSON.stringify(toolResult) })
    }
    const nextRequest = providerContinuationRequest(round.request_payload,
      responseItems(result.body), toolOutputs)
    const nextAnswerRound = round.answer_round + 1
    const nextProviderRound = round.provider_round + 1
    const nextEvidenceOrder = round.evidence_order + 2
    await captureEvidence(input, round.invocation_id, nextEvidenceOrder,
      "tool_round_request", { answer_round: round.answer_round,
        tool_calls: toolCalls as unknown as JSONValue[], tool_results: toolOutputs,
        provider_request: nextRequest }, "openai", result.provider_model, "pending")
    if (!await authorizeProviderRound(round.invocation_id,
      estimateProviderPayloadTokens(nextRequest), nextProviderRound)) {
      await finishAsyncRound(round, { status: "failed",
        terminal_receipt: receipt.archive_item_id, output_tokens: outputTokens(result.body),
        error_code: "provider_round_not_authorized", terminal_response: null,
        visible_content: visibleFailure })
      return { status: 200, disposition: "failed" }
    }
    const next = await callProvider("communications.answer", round.route_key,
      round.invocation_id, `${round.invocation_id}:answer:${nextAnswerRound}`,
      nextRequest, round.maximum_output_tokens, true,
      asyncRequestDeadline(round.async_deadline))
    const nextResponseId = providerResponseId(next.body)
    if (!next.gateway_call_id || !nextResponseId) {
      await finishAsyncRound(round, { status: next.ambiguous ? "paid_ambiguous" : "failed",
        terminal_receipt: receipt.archive_item_id, output_tokens: outputTokens(next.body),
        error_code: "background_continuation_failed", terminal_response: null,
        visible_content: visibleFailure })
      return { status: 200, disposition: "failed" }
    }
    await continueAsyncRound(round, { gateway_call_id: next.gateway_call_id,
      provider_response_id: nextResponseId, request_payload: nextRequest,
      answer_round: nextAnswerRound, provider_round: nextProviderRound,
      evidence_order: nextEvidenceOrder, provider_model: next.provider_model })
    if (next.body.status === "queued" || next.body.status === "in_progress") {
      return { status: 200, disposition: "continued" }
    }
    const claimed = await claimAsyncRound(next.gateway_call_id, nextResponseId)
    if (!claimed) return { status: 200, disposition: "continued" }
    round = claimed as AsyncRound
    callId = next.gateway_call_id
    responseId = nextResponseId
  }
}
