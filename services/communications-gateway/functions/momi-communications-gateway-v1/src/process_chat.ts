import type { JSONValue } from "postgres"
import { admitInvocation } from "./admit_invocation.ts"
import { archiveFailure } from "./archive_failure.ts"
import { assistantInstructions } from "./assistant_instructions.ts"
import { executeAdmittedChat } from "./execute_admitted_chat.ts"
import { hashRequest } from "./hash_request.ts"
import { loadAssistantContext } from "./load_assistant_context.ts"
import { estimateProviderPayloadTokens } from "./provider_payload_policy.ts"
import { replayResponse } from "./replay_response.ts"
import { toolDefinitions } from "./tool_definitions.ts"
import type { ChatInput } from "./types.ts"

export async function processChat(input: ChatInput): Promise<{
  status: number
  body: Record<string, JSONValue>
}> {
  const tools = JSON.parse(JSON.stringify(toolDefinitions)) as JSONValue[]
  const instructions = assistantInstructions(await loadAssistantContext())
  const admissionPayload: Record<string, JSONValue> = {
    model: "",
    instructions,
    messages: input.messages as unknown as JSONValue[],
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    store: false,
  }
  const admission = await admitInvocation(input,
    await hashRequest(input, instructions),
    estimateProviderPayloadTokens(admissionPayload))
  if (admission.disposition === "duplicate") return replayResponse(admission)
  try {
    return await executeAdmittedChat(input, admission, tools, instructions)
  } catch (error) {
    const code = error instanceof Error && [
        "invocation_deadline_exceeded",
        "provider_round_not_authorized",
        "tool_round_not_authorized",
      ].includes(error.message)
      ? error.message
      : "post_admission_failure"
    await archiveFailure(input, admission, code)
    return { status: 503, body: {
      id: admission.invocation_id,
      object: "momi.execution",
      model: "momi-assistant",
      status: "failed",
      error: "request_failed",
    } }
  }
}
