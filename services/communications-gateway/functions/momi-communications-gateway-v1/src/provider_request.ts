import type { JSONValue } from "postgres"
import { responsesInput } from "./responses_input.ts"
import { responsesTools } from "./responses_tools.ts"
import type { Message } from "./types.ts"

export function providerRequest(messages: Message[], safetyIdentifier: string,
  tools: JSONValue[], instructions: string): Record<string, JSONValue> {
  return {
    instructions,
    input: responsesInput(messages),
    tools: responsesTools(tools),
    tool_choice: "auto",
    parallel_tool_calls: true,
    safety_identifier: safetyIdentifier,
  }
}
