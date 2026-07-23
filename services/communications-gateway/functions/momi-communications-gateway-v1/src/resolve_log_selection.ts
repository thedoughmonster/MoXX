import type { JSONValue } from "postgres"
import { logIntentConfig } from "../config/log_intent_v1.ts"
import { normalizedLogIntent } from "./normalized_log_intent.ts"
import { structuredSelection } from "./structured_log_selection.ts"
import type { ChatInput, LogSelection } from "./types.ts"

const negative = /\b(?:do not|don't|dont|never|not to)\s+(?:log|save)\b/iu
const quoted = /["'“”‘’`]\s*(?:log this|save this to (?:the )?momi log)/iu
const ambiguous = /\b(?:maybe|perhaps|should we|might|unsure)\b/iu
const intents = new Map<string, "message" | "turn" | "conversation">([
  ...logIntentConfig.message.map((phrase) => [phrase, "message"] as const),
  ...logIntentConfig.turn.map((phrase) => [phrase, "turn"] as const),
  ...logIntentConfig.conversation.map((phrase) => [phrase, "conversation"] as const),
])

export function resolveLogSelection(input: ChatInput): LogSelection | null {
  if (input.momi_log) return structuredSelection(input, input.momi_log)
  const commandIndex = input.messages.length - 1
  const command = input.messages[commandIndex]
  if (command.role !== "user" || negative.test(command.content) ||
    quoted.test(command.content) || ambiguous.test(command.content)) return null
  const scope = intents.get(normalizedLogIntent(command.content))
  if (!scope) return null
  const priorMessages = input.messages.slice(0, commandIndex)
  if (scope === "conversation") return priorMessages.length ? {
    flag: { scope: "conversation" },
    content: { messages: priorMessages as unknown as JSONValue[] },
  } : null
  if (scope === "message") {
    const selectedIndex = commandIndex - 1
    const selected = input.messages[selectedIndex]
    return selected?.role === "assistant" ? { flag: { scope: "message",
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
