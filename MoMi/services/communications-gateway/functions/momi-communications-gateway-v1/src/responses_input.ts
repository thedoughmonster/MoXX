import type { JSONValue } from "postgres"
import type { Message } from "./types.ts"

export function responsesInput(messages: Message[]): JSONValue[] {
  const input: JSONValue[] = []
  for (const message of messages) {
    if (message.role === "tool") {
      input.push({ type: "function_call_output", call_id: message.tool_call_id,
        output: message.content })
      continue
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      if (message.content) input.push({ role: "assistant", content: message.content })
      for (const call of message.tool_calls) {
        input.push({ type: "function_call", call_id: call.id,
          name: call.function.name, arguments: call.function.arguments })
      }
      continue
    }
    input.push({ role: message.role, content: message.content })
  }
  return input
}
