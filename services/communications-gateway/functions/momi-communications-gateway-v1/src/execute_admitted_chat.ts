import type { JSONValue } from "postgres"
import { appendLogSelection } from "./append_log_selection.ts"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { failedProviderResponse } from "./failed_provider_response.ts"
import { firstProviderMessage } from "./first_provider_message.ts"
import { markArchiveAdmitted } from "./mark_archive_admitted.ts"
import { authorizeProviderRound } from "./mark_provider_started.ts"
import { outputTokens } from "./output_tokens.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { providerRequest } from "./provider_request.ts"
import { usage } from "./provider_usage.ts"
import { remainingDeadlineSeconds } from "./remaining_deadline_seconds.ts"
import { resolveLogSelection } from "./resolve_log_selection.ts"
import { runToolCall } from "./run_tool_call.ts"
import { successResponse } from "./success_response.ts"
import { toolCalls } from "./tool_calls.ts"
import { visibleAlias, type Admission, type ChatInput, type Message } from "./types.ts"

export async function executeAdmittedChat(input: ChatInput, admission: Admission,
  tools: JSONValue[]): Promise<{ status: number; body: Record<string, JSONValue> }> {
  const requestOne = providerRequest(input.messages, input.user.id, admission, tools)
  const admissionReceipt = await captureEvidence(input, admission.invocation_id, 0,
    "request_admission", { alias: visibleAlias, provider_request: requestOne },
    admission.provider_key, admission.provider_model, "pending")
  if (!await markArchiveAdmitted(admission.invocation_id, admissionReceipt.archive_item_id)) {
    throw new Error("archive_admission_state_failed")
  }
  const logSelection = resolveLogSelection(input)
  const toolContext = { input, invocationId: admission.invocation_id,
    archiveReceiptId: admissionReceipt.archive_item_id, logSelection }
  await appendLogSelection(logSelection, toolContext, createUserFlagLog)
  const requestOneTokens = estimateProviderPayloadTokens(requestOne)
  if (!await authorizeProviderRound(admission.invocation_id, requestOneTokens, 1)) {
    throw new Error("provider_round_not_authorized")
  }
  const first = await callProvider(admission.provider_endpoint, requestOne,
    remainingDeadlineSeconds(admission.invocation_deadline))
  const firstMessage = firstProviderMessage(first.body)
  const firstToolCalls = toolCalls(firstMessage)
  const firstTerminal = first.ambiguous ? "paid_ambiguous"
    : !first.ok ? "failed" : firstToolCalls.length ? "tool_pending" : "completed"
  const firstReceipt = await captureEvidence(input, admission.invocation_id, 1,
    "provider_round_1", { provider_request: requestOne, provider_response: first.body },
    admission.provider_key, admission.provider_model, firstTerminal, usage(first.body),
    { duration_ms: first.duration_ms, http_status: first.status })
  if (first.ambiguous || !first.ok) {
    const state = first.ambiguous ? "paid_ambiguous" : "failed"
    await completeInvocation(admission.invocation_id, state,
      firstReceipt.archive_item_id, 0, first.ambiguous
        ? "provider_transport_ambiguous" : `provider_http_${first.status}`)
    return failedProviderResponse(admission.invocation_id, state)
  }
  if (!firstToolCalls.length) {
    await completeInvocation(admission.invocation_id, "completed",
      firstReceipt.archive_item_id, outputTokens(first.body), null)
    return successResponse(first.body, admission.invocation_id)
  }
  const toolMessages: Message[] = []
  for (const rawCall of firstToolCalls) {
    if (!rawCall || typeof rawCall !== "object" || Array.isArray(rawCall)) continue
    const call = rawCall as Record<string, JSONValue>
    const result = await runToolCall(call, toolContext)
    toolMessages.push({ role: "tool", content: JSON.stringify(result),
      tool_call_id: typeof call.id === "string" ? call.id : "invalid-tool-call" })
  }
  const requestTwo = providerRequest(
    [...input.messages, firstMessage as Message, ...toolMessages], input.user.id,
    admission, tools)
  await captureEvidence(input, admission.invocation_id, 2, "tool_round_request",
    { tool_calls: firstToolCalls, tool_results: toolMessages as unknown as JSONValue[],
      provider_request: requestTwo }, admission.provider_key, admission.provider_model, "pending")
  if (!await authorizeProviderRound(admission.invocation_id,
    estimateProviderPayloadTokens(requestTwo), 2)) throw new Error("tool_round_not_authorized")
  const second = await callProvider(admission.provider_endpoint, requestTwo,
    remainingDeadlineSeconds(admission.invocation_deadline))
  const state = second.ambiguous ? "paid_ambiguous" : second.ok ? "completed" : "failed"
  const receipt = await captureEvidence(input, admission.invocation_id, 3,
    "provider_round_2", { provider_request: requestTwo, provider_response: second.body },
    admission.provider_key, admission.provider_model, state, usage(second.body),
    { duration_ms: second.duration_ms, http_status: second.status })
  await completeInvocation(admission.invocation_id, state, receipt.archive_item_id,
    outputTokens(second.body), second.ok ? null : second.ambiguous
      ? "provider_transport_ambiguous" : `provider_http_${second.status}`)
  return second.ok ? successResponse(second.body, admission.invocation_id)
    : failedProviderResponse(admission.invocation_id, state)
}
