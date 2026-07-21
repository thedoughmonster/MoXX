import type { JSONValue } from "postgres"
import type { LogSelection } from "./resolve_log_selection.ts"
import type { ChatInput, UserFlag } from "./types.ts"

export function structuredSelection(input: ChatInput, flag: UserFlag): LogSelection | null {
  const latest = [...input.messages].reverse().find((message) => message.role === "user")
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
  if (!latest) return null
  return { flag, content: { selected_content: latest.content } }
}
