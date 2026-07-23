import type { HumanMessageInput } from "./types.ts"

export function parseInput(value: unknown): HumanMessageInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const required = ["source_account_key", "source_user_key",
    "source_conversation_key", "source_message_key", "sender_role", "content",
    "idempotency_key", "occurred_at"]
  if (required.some((key) => typeof input[key] !== "string") ||
    !["user", "assistant"].includes(input.sender_role as string) ||
    (input.content as string).length > 240000 ||
    Number.isNaN(Date.parse(input.occurred_at as string)) ||
    !input.source_metadata || typeof input.source_metadata !== "object" ||
    Array.isArray(input.source_metadata) ||
    !(input.source_parent_message_key === undefined ||
      input.source_parent_message_key === null ||
      typeof input.source_parent_message_key === "string")) return null
  return input as HumanMessageInput
}
