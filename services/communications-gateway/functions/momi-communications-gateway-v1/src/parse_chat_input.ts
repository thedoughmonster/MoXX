import { visibleAlias, type ChatInput, type Message } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const roles = new Set(["system", "developer", "user", "assistant"])
const scopes = new Set(["message", "turn", "range", "conversation"])

export function parseChatInput(value: unknown): ChatInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const allowed = new Set([
    "model", "messages", "user", "conversation_id", "turn_id",
    "idempotency_key", "momi_log",
  ])
  if (Object.keys(input).some((key) => !allowed.has(key)) ||
    input.model !== visibleAlias || !Array.isArray(input.messages) ||
    input.messages.length < 1 || input.messages.length > 100) return null
  const user = input.user as Record<string, unknown> | null
  if (!user || typeof user !== "object" || Array.isArray(user) ||
    Object.keys(user).some((key) => !["id", "email"].includes(key)) ||
    typeof user.id !== "string" || !uuid.test(user.id) ||
    typeof user.email !== "string" || user.email !== user.email.toLowerCase() ||
    !user.email.includes("@")) return null
  const messages: Message[] = []
  let totalCharacters = 0
  for (const item of input.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null
    const message = item as Record<string, unknown>
    if (Object.keys(message).some((key) => !["role", "content"].includes(key)) ||
      typeof message.role !== "string" || !roles.has(message.role) ||
      typeof message.content !== "string" || message.content.length > 120000) return null
    totalCharacters += message.content.length
    messages.push(message as Message)
  }
  if (totalCharacters > 240000) return null
  for (const key of ["conversation_id", "turn_id", "idempotency_key"] as const) {
    if (typeof input[key] !== "string" || input[key].length < 1 || input[key].length > 256) return null
  }
  if (input.momi_log !== undefined) {
    if (!input.momi_log || typeof input.momi_log !== "object" || Array.isArray(input.momi_log)) return null
    const flag = input.momi_log as Record<string, unknown>
    const flagKeys = ["scope", "message_id", "range", "note", "category"]
    if (Object.keys(flag).some((key) => !flagKeys.includes(key)) ||
      typeof flag.scope !== "string" || !scopes.has(flag.scope) ||
      !(flag.message_id === undefined || typeof flag.message_id === "string") ||
      !(flag.range === undefined || flag.range && typeof flag.range === "object" &&
        !Array.isArray(flag.range)) ||
      !(flag.note === undefined || typeof flag.note === "string" && flag.note.length <= 2000) ||
      !(flag.category === undefined || typeof flag.category === "string" &&
        flag.category.length <= 120)) return null
  }
  return { ...input, messages, user: { id: user.id, email: user.email } } as ChatInput
}
