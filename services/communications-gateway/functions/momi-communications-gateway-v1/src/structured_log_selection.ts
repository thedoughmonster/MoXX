import type { JSONValue } from "postgres"
import type { ChatInput, LogSelection, UserFlag } from "./types.ts"

export function structuredSelection(input: ChatInput, flag: UserFlag): LogSelection | null {
  if (flag.source_user_id !== input.user.id ||
    flag.source_conversation_id !== input.conversation_id) return null
  if (flag.scope === "message") {
    if (!flag.message_id || flag.source_turn_id !== input.turn_id || !flag.selected_content) return null
    return { flag, content: { selected_content: flag.selected_content } }
  }
  if (flag.scope === "range") {
    if (!flag.range || !flag.selected_content) return null
    return { flag, content: { selected_content: flag.selected_content } }
  }
  if (flag.scope === "conversation") {
    return { flag, content: { messages: input.messages as unknown as JSONValue[] } }
  }
  if (flag.source_turn_id !== input.turn_id) return null
  const turnStart = input.messages.findLastIndex((message) => message.role === "user")
  if (turnStart < 0) return null
  const selected = input.messages.slice(turnStart)
  return { flag, content: {
    selected_content: selected.map((message) => message.content).join("\n"),
    messages: selected as unknown as JSONValue[],
  } }
}
