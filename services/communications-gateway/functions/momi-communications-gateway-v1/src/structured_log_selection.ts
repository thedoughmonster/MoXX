import type { JSONValue } from "postgres"
import type { ChatInput, LogSelection, UserFlag } from "./types.ts"

export function structuredSelection(input: ChatInput, flag: UserFlag): LogSelection | null {
  if (flag.scope === "message") {
    if (!flag.message_id || !flag.selected_content) return null
    return { flag, content: { selected_content: flag.selected_content } }
  }
  if (flag.scope === "range") {
    if (!flag.range || !flag.selected_content) return null
    return { flag, content: { selected_content: flag.selected_content } }
  }
  if (flag.scope === "conversation") {
    return { flag, content: { messages: input.messages as unknown as JSONValue[] } }
  }
  const turnStart = input.messages.findLastIndex((message) => message.role === "user")
  if (turnStart < 0) return null
  const selected = input.messages.slice(turnStart)
  return { flag, content: {
    selected_content: selected.map((message) => message.content).join("\n"),
    messages: selected as unknown as JSONValue[],
  } }
}
