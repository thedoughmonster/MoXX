import type { JSONValue } from "postgres"
import { structuredSelection } from "./structured_log_selection.ts"
import type { ChatInput, LogSelection } from "./types.ts"

const affirmative = /^(?:please\s+)?(?:momi[, :]*)?(?:log this(?: (message|turn|conversation))?|save this to (?:the )?momi log)[.!\s]*$/iu
const negative = /\b(?:do not|don't|dont|never|not to)\s+(?:log|save)\b/iu
const quoted = /["'“”‘’`]\s*(?:log this|save this to (?:the )?momi log)/iu

export function resolveLogSelection(input: ChatInput): LogSelection | null {
  if (input.momi_log) return structuredSelection(input, input.momi_log)
  const commandIndex = input.messages.length - 1
  const command = input.messages[commandIndex]
  if (command.role !== "user" || negative.test(command.content) ||
    quoted.test(command.content)) return null
  const match = affirmative.exec(command.content.trim())
  if (!match) return null
  const priorMessages = input.messages.slice(0, commandIndex)
  if (match[1] === "conversation") return priorMessages.length ? {
    flag: { scope: "conversation" },
    content: { messages: priorMessages as unknown as JSONValue[] },
  } : null
  if (match[1] === "message") {
    const selectedIndex = commandIndex - 1
    const selected = input.messages[selectedIndex]
    return selected ? { flag: { scope: "message",
      message_id: `${input.conversation_id}:model-visible-message:${selectedIndex}` },
      content: { selected_content: selected.content } } : null
  }
  const turnStart = priorMessages.findLastIndex((message) => message.role === "user")
  if (turnStart < 0) return null
  const selected = priorMessages.slice(turnStart)
  return { flag: { scope: "turn" }, content: {
    selected_content: selected.map((message) => message.content).join("\n"),
    messages: selected as unknown as JSONValue[],
  } }
}
