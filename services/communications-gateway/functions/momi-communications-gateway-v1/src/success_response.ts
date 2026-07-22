import type { JSONValue } from "postgres"
import { chatUsage } from "./chat_usage.ts"
import { responseText } from "./response_text.ts"
import { visibleAlias } from "./types.ts"

export function successResponse(body: Record<string, JSONValue>, id: string) {
  return { status: 200, body: { id, object: "chat.completion", model: visibleAlias,
    choices: [{ index: 0, message: { role: "assistant", content: responseText(body) },
      finish_reason: "stop" }], usage: chatUsage(body) } }
}
