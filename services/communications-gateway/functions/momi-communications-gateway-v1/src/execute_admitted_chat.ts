import type { JSONValue } from "postgres"
import { beginRoute } from "./begin_route.ts"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { failedProviderResponse } from "./failed_provider_response.ts"
import { authorizeProviderRound } from "./mark_provider_started.ts"
import { outputTokens } from "./output_tokens.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { providerContinuationRequest } from "./provider_continuation_request.ts"
import { providerRequest } from "./provider_request.ts"
import { responseItems } from "./response_items.ts"
import { responseText } from "./response_text.ts"
import { responseToolCalls } from "./response_tool_calls.ts"
import { usage } from "./provider_usage.ts"
import { remainingDeadlineSeconds } from "./remaining_deadline_seconds.ts"
import { resolveLogSelection } from "./resolve_log_selection.ts"
import { runToolCall } from "./run_tool_call.ts"
import { successResponse } from "./success_response.ts"
import type { Admission, ChatInput } from "./types.ts"

export async function executeAdmittedChat(input: ChatInput, admission: Admission,
  tools: JSONValue[]): Promise<{ status: number; body: Record<string, JSONValue> }> {
  const begun = await beginRoute(input, admission, tools)
  if (begun.failure) return begun.failure
  if (!begun.route) throw new Error("route_selection_failed")
  const route = begun.route
  const requestOne = providerRequest(input.messages, input.user.id, admission, route, tools)
  const logSelection = resolveLogSelection(input)
  const toolContext = { input, invocationId: admission.invocation_id,
    archiveReceiptId: begun.archiveReceiptId, logSelection }
  const requestOneTokens = estimateProviderPayloadTokens(requestOne)
  if (!await authorizeProviderRound(admission.invocation_id, requestOneTokens,
    begun.providerRound)) {
    throw new Error("provider_round_not_authorized")
  }
  const first = await callProvider(admission.provider_endpoint, requestOne,
    remainingDeadlineSeconds(admission.invocation_deadline))
  const firstToolCalls = responseToolCalls(first.body)
  const firstHasText = Boolean(responseText(first.body))
  const firstTerminal = first.ambiguous ? "paid_ambiguous"
    : !first.ok || (!firstToolCalls.length && !firstHasText) ? "failed"
    : firstToolCalls.length ? "tool_pending" : "completed"
  const firstReceipt = await captureEvidence(input, admission.invocation_id,
    begun.evidenceOrder,
    "provider_round_1", { provider_request: requestOne, provider_response: first.body },
    admission.provider_key, route.provider_model, firstTerminal, usage(first.body),
    { duration_ms: first.duration_ms, http_status: first.status })
  if (first.ambiguous || !first.ok) {
    const state = first.ambiguous ? "paid_ambiguous" : "failed"
    await completeInvocation(admission.invocation_id, state,
      firstReceipt.archive_item_id, 0, first.ambiguous
        ? "provider_transport_ambiguous" : `provider_http_${first.status}`)
    return failedProviderResponse(admission.invocation_id, state)
  }
  if (!firstToolCalls.length) {
    if (!firstHasText) {
      await completeInvocation(admission.invocation_id, "failed",
        firstReceipt.archive_item_id, outputTokens(first.body),
        "provider_response_missing_output_text")
      return failedProviderResponse(admission.invocation_id, "failed")
    }
    await completeInvocation(admission.invocation_id, "completed",
      firstReceipt.archive_item_id, outputTokens(first.body), null)
    return successResponse(first.body, admission.invocation_id)
  }
  const toolOutputs: JSONValue[] = []
  for (const call of firstToolCalls) {
    const result = await runToolCall(call, toolContext)
    toolOutputs.push({ type: "function_call_output", call_id: call.id,
      output: JSON.stringify(result) })
  }
  const requestTwo = providerContinuationRequest(requestOne, responseItems(first.body), toolOutputs)
  await captureEvidence(input, admission.invocation_id, begun.evidenceOrder + 1,
    "tool_round_request",
    { tool_calls: firstToolCalls as unknown as JSONValue[], tool_results: toolOutputs,
      provider_request: requestTwo }, admission.provider_key, route.provider_model, "pending")
  if (!await authorizeProviderRound(admission.invocation_id,
    estimateProviderPayloadTokens(requestTwo), begun.providerRound + 1 as 2 | 3)) {
    throw new Error("tool_round_not_authorized")
  }
  const second = await callProvider(admission.provider_endpoint, requestTwo,
    remainingDeadlineSeconds(admission.invocation_deadline))
  const secondHasText = Boolean(responseText(second.body))
  const state = second.ambiguous ? "paid_ambiguous"
    : second.ok && secondHasText ? "completed" : "failed"
  const receipt = await captureEvidence(input, admission.invocation_id,
    begun.evidenceOrder + 2,
    "provider_round_2", { provider_request: requestTwo, provider_response: second.body },
    admission.provider_key, route.provider_model, state, usage(second.body),
    { duration_ms: second.duration_ms, http_status: second.status })
  await completeInvocation(admission.invocation_id, state, receipt.archive_item_id,
    outputTokens(second.body), second.ok && secondHasText ? null : second.ambiguous
      ? "provider_transport_ambiguous" : second.ok
      ? "provider_response_missing_output_text" : `provider_http_${second.status}`)
  return second.ok && secondHasText ? successResponse(second.body, admission.invocation_id)
    : failedProviderResponse(admission.invocation_id, state)
}
