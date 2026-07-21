import type { JSONValue } from "postgres"
import { structuredSelection } from "./structured_log_selection.ts"
import type { ChatInput, UserFlag } from "./types.ts"

export type LogSelection = {
  flag: UserFlag
  content: Record<string, JSONValue>
}

const affirmative = /^(?:please\s+)?(?:momi[, :]*)?(?:log this(?: (message|turn|conversation))?|save this to (?:the )?momi log)[.!\s]*$/iu
const negative = /\b(?:do not|don't|dont|never|not to)\s+(?:log|save)\b/iu
const quoted = /["'“”‘’`]\s*(?:log this|save this to (?:the )?momi log)/iu

export function resolveLogSelection(input: ChatInput): LogSelection | null {
  if (input.momi_log) return structuredSelection(input, input.momi_log)
  const latest = [...input.messages].reverse().find((message) => message.role === "user")
  if (!latest || negative.test(latest.content) || quoted.test(latest.content)) return null
  const match = affirmative.exec(latest.content.trim())
  if (!match) return null
  const scope = match[1] === "conversation" ? "conversation" : "turn"
  return scope === "conversation"
    ? { flag: { scope }, content: { messages: input.messages as unknown as JSONValue[] } }
    : { flag: { scope }, content: { selected_content: latest.content } }
}
