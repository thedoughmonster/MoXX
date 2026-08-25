import { validRange } from "./valid_range.ts"
import { routeKeys, visibleAlias, type ChatInput, type Message } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const roles = new Set(["system", "developer", "user", "assistant", "tool"])
const scopes = new Set(["message", "turn", "range", "conversation"])

export function parseChatInput(value: unknown): ChatInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const allowed = new Set([
    "model", "messages", "user", "conversation_id", "turn_id",
    "idempotency_key", "momi_log", "momi_route",
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
    if (typeof message.role !== "string" || !roles.has(message.role) ||
      typeof message.content !== "string" || message.content.length > 120000) return null
    const allowedMessageKeys = message.role === "assistant"
      ? ["role", "content", "tool_calls"]
      : message.role === "tool" ? ["role", "content", "tool_call_id"] : ["role", "content"]
    if (Object.keys(message).some((key) => !allowedMessageKeys.includes(key))) return null
    if (message.role === "tool" && (typeof message.tool_call_id !== "string" ||
      message.tool_call_id.length < 1 || message.tool_call_id.length > 256)) return null
    if (message.role === "assistant" && message.tool_calls !== undefined) {
      if (!Array.isArray(message.tool_calls) || message.tool_calls.length < 1 ||
        message.tool_calls.length > 16) return null
      for (const item of message.tool_calls) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null
        const call = item as Record<string, unknown>
        const called = call.function as Record<string, unknown> | null
        if (Object.keys(call).some((key) => !["id", "type", "function"].includes(key)) ||
          typeof call.id !== "string" || call.id.length < 1 || call.id.length > 256 ||
          call.type !== "function" || !called || typeof called !== "object" ||
          Array.isArray(called) || Object.keys(called).some((key) =>
            !["name", "arguments"].includes(key)) || typeof called.name !== "string" ||
          called.name.length < 1 || called.name.length > 120 ||
          typeof called.arguments !== "string" || called.arguments.length > 120000) return null
        totalCharacters += call.id.length + called.name.length + called.arguments.length
      }
    }
    totalCharacters += message.content.length
    messages.push(message as Message)
  }
  if (totalCharacters > 240000) return null
  for (const key of ["conversation_id", "turn_id", "idempotency_key"] as const) {
    if (typeof input[key] !== "string" || input[key].length < 1 || input[key].length > 256) return null
  }
  if (input.momi_route !== undefined && input.momi_route !== "auto" &&
    !routeKeys.includes(input.momi_route as typeof routeKeys[number])) return null
  if (input.momi_log !== undefined) {
    if (!input.momi_log || typeof input.momi_log !== "object" || Array.isArray(input.momi_log)) return null
    const flag = input.momi_log as Record<string, unknown>
    const flagKeys = [
      "scope", "source_user_id", "source_conversation_id", "message_id",
      "source_turn_id", "range", "selected_content", "note", "category",
    ]
    if (Object.keys(flag).some((key) => !flagKeys.includes(key)) ||
      typeof flag.scope !== "string" || !scopes.has(flag.scope) ||
      typeof flag.source_user_id !== "string" || !uuid.test(flag.source_user_id) ||
      typeof flag.source_conversation_id !== "string" ||
      flag.source_conversation_id.length < 1 || flag.source_conversation_id.length > 256 ||
      !(flag.message_id === undefined || typeof flag.message_id === "string" &&
        flag.message_id.length > 0 && flag.message_id.length <= 256) ||
      !(flag.source_turn_id === undefined || typeof flag.source_turn_id === "string" &&
        flag.source_turn_id.length > 0 && flag.source_turn_id.length <= 256) ||
      !(flag.selected_content === undefined || typeof flag.selected_content === "string" &&
        flag.selected_content.length > 0 && flag.selected_content.length <= 240000) ||
      !(flag.range === undefined || validRange(flag.range)) ||
      !(flag.note === undefined || typeof flag.note === "string" && flag.note.length <= 2000) ||
      !(flag.category === undefined || typeof flag.category === "string" &&
        flag.category.length <= 120)) return null
    if ((flag.scope === "message" && (typeof flag.message_id !== "string" ||
        typeof flag.source_turn_id !== "string" ||
        typeof flag.selected_content !== "string" || flag.range !== undefined)) ||
      (flag.scope === "range" && (!validRange(flag.range) ||
        typeof flag.selected_content !== "string" || flag.message_id !== undefined ||
        flag.source_turn_id !== undefined)) ||
      (flag.scope === "turn" && (typeof flag.source_turn_id !== "string" ||
        flag.message_id !== undefined || flag.range !== undefined ||
        flag.selected_content !== undefined)) ||
      (flag.scope === "conversation" && (flag.source_turn_id !== undefined ||
        flag.message_id !== undefined || flag.range !== undefined ||
        flag.selected_content !== undefined))) return null
  }
  return { ...input, messages, user: { id: user.id, email: user.email } } as ChatInput
}
