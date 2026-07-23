import type { JSONValue } from "postgres"

export function logChatResponse(log: Record<string, JSONValue>): {
  status: number
  body: Record<string, JSONValue>
} {
  return { status: 200, body: {
    id: log.id,
    object: "chat.completion",
    model: "momi-assistant",
    choices: [{
      index: 0,
      message: { role: "assistant", content: "Logged to MoMi." },
      finish_reason: "stop",
    }],
    momi_log: {
      disposition: log.disposition,
      selection_id: log.selection_id,
      shop_log_id: log.shop_log_id,
    },
  } }
}
