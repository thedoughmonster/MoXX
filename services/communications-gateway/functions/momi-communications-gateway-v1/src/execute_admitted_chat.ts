import type { JSONValue } from "postgres"
import { beginRoute } from "./begin_route.ts"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { completeProviderLimitation } from "./complete_provider_limitation.ts"
import { failedProviderResponse } from "./failed_provider_response.ts"
import { authorizeProviderRound } from "./mark_provider_started.ts"
import { outputTokens } from "./output_tokens.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { providerContinuationRequest } from "./provider_continuation_request.ts"
import { providerRequest } from "./provider_request.ts"
import { responseItems } from "./response_items.ts"
import { responseCompleted } from "./response_completed.ts"
import { responseText } from "./response_text.ts"
import { responseToolCalls } from "./response_tool_calls.ts"
import { usage } from "./provider_usage.ts"
import { remainingDeadlineSeconds } from "./remaining_deadline_seconds.ts"
import { resolveLogSelection } from "./resolve_log_selection.ts"
import { runToolCall } from "./run_tool_call.ts"
import { successResponse } from "./success_response.ts"
import { terminalLimitationCodes } from "./terminal_limitation_response.ts"
import type { Admission, ChatInput } from "./types.ts"
import { waitForBackgroundResponse } from "./wait_for_background_response.ts"

const safeProviderErrors = new Set([
  "provider_background_deadline_exceeded",
  "provider_background_id_missing",
  "provider_background_poll_failed",
  "provider_transport_ambiguous",
])

export async function executeAdmittedChat(input: ChatInput, admission: Admission,
  tools: JSONValue[], instructions: string): Promise<{
    status: number; body: Record<string, JSONValue>
  }> {
  const begun = await beginRoute(input, admission, tools)
  if (begun.failure) return begun.failure
  if (!begun.route) throw new Error("route_selection_failed")
  const route = begun.route
  let request = providerRequest(input.messages, input.user.id, admission,
    route, tools, instructions)
  const logSelection = resolveLogSelection(input)
  const toolContext = { input, invocationId: admission.invocation_id,
    archiveReceiptId: begun.archiveReceiptId, logSelection }
  await captureEvidence(input, admission.invocation_id, begun.evidenceOrder,
    "selected_provider_request", { selected_route: route.route_key,
      routing_source: route.source, reasoning_effort: route.reasoning_effort,
      provider_request: request }, admission.provider_key,
    route.provider_model, "pending")
  let providerRound = begun.providerRound as number
  let answerRound = 1
  let evidenceOrder = begun.evidenceOrder
  while (true) {
    if (!await authorizeProviderRound(admission.invocation_id,
      estimateProviderPayloadTokens(request), providerRound)) {
      throw new Error("provider_round_not_authorized")
    }
    const remaining = remainingDeadlineSeconds(admission.invocation_deadline)
    const initial = await callProvider(route.provider_endpoint, request,
      request.background === true ? Math.min(15, remaining) : remaining)
    const background = await waitForBackgroundResponse(
      route.provider_endpoint,
      initial,
      admission.invocation_deadline,
    )
    const result = background.result
    const toolCalls = responseToolCalls(result.body)
    const completed = responseCompleted(result.body)
    const hasText = Boolean(responseText(result.body))
    const terminal = result.ambiguous ? "paid_ambiguous"
      : !result.ok || !completed || (!toolCalls.length && !hasText) ? "failed"
      : toolCalls.length ? "tool_pending" : "completed"
    const receipt = await captureEvidence(input, admission.invocation_id,
      ++evidenceOrder, `provider_round_${answerRound}`,
      { provider_request: request, provider_response: result.body,
        provider_observations: background.observations },
      admission.provider_key, route.provider_model, terminal, usage(result.body),
      { duration_ms: result.duration_ms, http_status: result.status })
    if (result.ambiguous || !result.ok || !completed || !toolCalls.length) {
      const state = terminal === "completed" ? "completed"
        : result.ambiguous ? "paid_ambiguous" : "failed"
      const errorBody = result.body.error
      const errorType = errorBody && typeof errorBody === "object" &&
          !Array.isArray(errorBody) && !(errorBody instanceof Date)
        ? (errorBody as Record<string, JSONValue>).type : null
      const providerError = typeof errorType === "string" &&
          safeProviderErrors.has(errorType)
        ? errorType
        : null
      const error = state === "completed" ? null : providerError ??
          (result.ambiguous ? "provider_transport_ambiguous" : !result.ok
        ? `provider_http_${result.status}` : !completed
        ? "provider_response_incomplete" : "provider_response_missing_output_text")
      if (providerError && terminalLimitationCodes.has(providerError)) {
        return await completeProviderLimitation(
          admission,
          receipt.archive_item_id,
          result.body,
          providerError,
        )
      }
      const response = state === "completed" ? successResponse(result.body,
        admission.invocation_id) : failedProviderResponse(
          admission.invocation_id,
          state,
          error ?? undefined,
        )
      await completeInvocation(admission.invocation_id, state,
        receipt.archive_item_id, outputTokens(result.body), error,
        state === "completed" ? response.body : null)
      return response
    }
    const toolOutputs: JSONValue[] = []
    for (const call of toolCalls) {
      const toolResult = await runToolCall(call, toolContext)
      toolOutputs.push({ type: "function_call_output", call_id: call.id,
        output: JSON.stringify(toolResult) })
    }
    request = providerContinuationRequest(request, responseItems(result.body), toolOutputs)
    await captureEvidence(input, admission.invocation_id, ++evidenceOrder,
      "tool_round_request", { answer_round: answerRound,
        tool_calls: toolCalls as unknown as JSONValue[], tool_results: toolOutputs,
        provider_request: request }, admission.provider_key, route.provider_model, "pending")
    providerRound += 1
    answerRound += 1
  }
}
