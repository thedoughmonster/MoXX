import type { JSONValue } from "postgres"
import { admitInvocation } from "./admit_invocation.ts"
import { callProvider } from "./call_provider.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { hasLogIntent } from "./has_log_intent.ts"
import { hashRequest } from "./hash_request.ts"
import { markArchiveAdmitted } from "./mark_archive_admitted.ts"
import { markProviderStarted } from "./mark_provider_started.ts"
import { runToolCall } from "./run_tool_call.ts"
import { toolDefinitions } from "./tool_definitions.ts"
import { visibleAlias, type ChatInput, type Message } from "./types.ts"

export async function processChat(input: ChatInput): Promise<{
  status: number
  body: Record<string, JSONValue>
}> {
  const admission = await admitInvocation(input, await hashRequest(input))
  if (admission.disposition === "duplicate") {
    return { status: 202, body: { id: admission.invocation_id,
      object: "momi.execution", model: visibleAlias, status: "existing" } }
  }
  const tools = JSON.parse(JSON.stringify(toolDefinitions)) as JSONValue[]
  const requestOne: Record<string, JSONValue> = {
    model: admission.provider_model, messages: input.messages as unknown as JSONValue[],
    tools, tool_choice: "auto", parallel_tool_calls: false,
    max_tokens: admission.maximum_output_tokens, store: false,
  }
  const admissionReceipt = await captureEvidence(input, admission.invocation_id,
    0, "request_admission", { alias: visibleAlias, provider_request: requestOne },
    admission.provider_key, admission.provider_model, "pending")
  if (!await markArchiveAdmitted(admission.invocation_id, admissionReceipt.archive_item_id)) {
    throw new Error("archive admission state transition failed")
  }
  if (hasLogIntent(input)) {
    const latest = [...input.messages].reverse().find((message) => message.role === "user")
    const flag = input.momi_log ?? { scope: "turn" as const,
      note: "Explicit natural-language log request" }
    await createUserFlagLog(flag, { selected_message: latest?.content ?? "",
      source_turn_id: input.turn_id }, { input, invocationId: admission.invocation_id,
      archiveReceiptId: admissionReceipt.archive_item_id })
  }
  if (!await markProviderStarted(admission.invocation_id)) {
    throw new Error("provider start state transition failed")
  }
  const first = await callProvider(admission.provider_endpoint, requestOne,
    admission.timeout_seconds)
  const firstChoices = first.body.choices
  const firstChoice = Array.isArray(firstChoices) ? firstChoices[0] : null
  const firstMessage = firstChoice && typeof firstChoice === "object" && !Array.isArray(firstChoice)
    ? firstChoice.message : null
  const firstToolCalls = firstMessage && typeof firstMessage === "object" && !Array.isArray(firstMessage)
    && Array.isArray(firstMessage.tool_calls) ? firstMessage.tool_calls : []
  const firstTerminal = first.ambiguous ? "paid_ambiguous"
    : !first.ok ? "failed" : firstToolCalls.length === 0 ? "completed" : "tool_pending"
  const firstReceipt = await captureEvidence(input, admission.invocation_id,
    1, "provider_round_1", { provider_request: requestOne, provider_response: first.body },
    admission.provider_key, admission.provider_model, firstTerminal,
    first.body.usage && typeof first.body.usage === "object" && !Array.isArray(first.body.usage)
      ? first.body.usage as Record<string, JSONValue> : {},
    { duration_ms: first.duration_ms, http_status: first.status })
  if (first.ambiguous || !first.ok) {
    const state = first.ambiguous ? "paid_ambiguous" : "failed"
    await completeInvocation(admission.invocation_id, state,
      firstReceipt.archive_item_id, 0, admission.maximum_attempt_cost_micros,
      first.ambiguous ? "provider_transport_ambiguous" : `provider_http_${first.status}`)
    return { status: 502, body: { id: admission.invocation_id,
      object: "momi.execution", model: visibleAlias, status: state } }
  }
  if (firstToolCalls.length === 0) {
    const usage = first.body.usage as Record<string, JSONValue> | undefined
    const outputTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0
    await completeInvocation(admission.invocation_id, "completed",
      firstReceipt.archive_item_id, outputTokens,
      admission.maximum_attempt_cost_micros, null)
    return { status: 200, body: { ...first.body, id: admission.invocation_id,
      object: "chat.completion", model: visibleAlias } }
  }
  const toolMessages: Message[] = []
  for (const rawCall of firstToolCalls) {
    if (!rawCall || typeof rawCall !== "object" || Array.isArray(rawCall)) continue
    const call = rawCall as Record<string, JSONValue>
    const result = await runToolCall(call, { input,
      invocationId: admission.invocation_id,
      archiveReceiptId: firstReceipt.archive_item_id })
    toolMessages.push({ role: "tool", content: JSON.stringify(result),
      tool_call_id: typeof call.id === "string" ? call.id : "invalid-tool-call" })
  }
  const messagesTwo = [...input.messages, firstMessage as Message, ...toolMessages]
  const requestTwo: Record<string, JSONValue> = { ...requestOne,
    messages: messagesTwo as unknown as JSONValue[] }
  await captureEvidence(input, admission.invocation_id, 2, "tool_round_request",
    { tool_calls: firstToolCalls, tool_results: toolMessages as unknown as JSONValue[],
      provider_request: requestTwo }, admission.provider_key,
    admission.provider_model, "pending")
  const second = await callProvider(admission.provider_endpoint, requestTwo,
    admission.timeout_seconds)
  const secondStatus = second.ambiguous ? "paid_ambiguous" : second.ok ? "completed" : "failed"
  const secondReceipt = await captureEvidence(input, admission.invocation_id,
    3, "provider_round_2", { provider_request: requestTwo, provider_response: second.body },
    admission.provider_key, admission.provider_model, secondStatus,
    second.body.usage && typeof second.body.usage === "object" && !Array.isArray(second.body.usage)
      ? second.body.usage as Record<string, JSONValue> : {},
    { duration_ms: second.duration_ms, http_status: second.status })
  const usage = second.body.usage as Record<string, JSONValue> | undefined
  const outputTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0
  await completeInvocation(admission.invocation_id, secondStatus,
    secondReceipt.archive_item_id, outputTokens,
    admission.maximum_attempt_cost_micros, second.ok ? null :
      second.ambiguous ? "provider_transport_ambiguous" : `provider_http_${second.status}`)
  return second.ok ? { status: 200, body: { ...second.body,
    id: admission.invocation_id, object: "chat.completion", model: visibleAlias } }
    : { status: 502, body: { id: admission.invocation_id,
      object: "momi.execution", model: visibleAlias, status: secondStatus } }
}
