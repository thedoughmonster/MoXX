import type { JSONValue } from "postgres"
import type { Admission, Message } from "./types.ts"

export function providerRequest(messages: Message[], safetyIdentifier: string,
  admission: Admission, tools: JSONValue[]): Record<string, JSONValue> {
  return {
    model: admission.provider_model,
    messages: messages as unknown as JSONValue[],
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning_effort: "none",
    max_completion_tokens: admission.maximum_output_tokens,
    safety_identifier: safetyIdentifier,
    store: false,
  }
}
