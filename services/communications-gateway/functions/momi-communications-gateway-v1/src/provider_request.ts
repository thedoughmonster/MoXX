import type { JSONValue } from "postgres"
import { responsesInput } from "./responses_input.ts"
import { responsesTools } from "./responses_tools.ts"
import type { Admission, Message, RouteSelection } from "./types.ts"

export function providerRequest(messages: Message[], safetyIdentifier: string,
  admission: Admission, route: RouteSelection, tools: JSONValue[]): Record<string, JSONValue> {
  return {
    model: route.provider_model,
    input: responsesInput(messages),
    tools: responsesTools(tools),
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: { effort: route.reasoning_effort },
    max_output_tokens: Math.min(admission.maximum_output_tokens,
      route.maximum_output_tokens),
    safety_identifier: safetyIdentifier,
    store: false,
  }
}
