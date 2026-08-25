import { logIntentConfig } from "../config/log_intent_v1.ts"
import { normalizedLogIntent } from "./normalized_log_intent.ts"
import type { ChatInput } from "./types.ts"

const negative = /\b(?:do not|don't|dont|never|not to)\s+(?:log|save)\b/iu
const quoted = /["'“”‘’`]\s*(?:log this|save this to (?:the )?momi log)/iu
const ambiguous = /\b(?:maybe|perhaps|should we|might|unsure)\b/iu
const intents = new Map<string, "message" | "turn" | "conversation">([
  ...logIntentConfig.message.map((phrase) => [phrase, "message"] as const),
  ...logIntentConfig.turn.map((phrase) => [phrase, "turn"] as const),
  ...logIntentConfig.conversation.map((phrase) => [phrase, "conversation"] as const),
])

export function logIntentScope(
  input: ChatInput,
): "message" | "turn" | "conversation" | null {
  const command = input.messages.at(-1)
  if (!command || command.role !== "user" || negative.test(command.content) ||
    quoted.test(command.content) || ambiguous.test(command.content)) return null
  return intents.get(normalizedLogIntent(command.content)) ?? null
}
