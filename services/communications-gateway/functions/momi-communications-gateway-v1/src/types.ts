import type { JSONValue } from "postgres"

export const functionKey = "momi.communications.chat_completions.v1"
export const visibleAlias = "momi-assistant"

export type Message = {
  role: "system" | "developer" | "user" | "assistant" | "tool"
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: JSONValue[]
}

export type UserFlag = {
  scope: "message" | "turn" | "range" | "conversation"
  message_id?: string
  range?: Record<string, JSONValue>
  selected_content?: string
  note?: string
  category?: string
}

export type ChatInput = {
  model: typeof visibleAlias
  messages: Message[]
  user: { id: string; email: string }
  conversation_id: string
  turn_id: string
  idempotency_key: string
  momi_log?: UserFlag
}

export type Admission = {
  disposition: "admitted" | "duplicate"
  invocation_id: string
  provider_key: string
  provider_model: string
  provider_endpoint: string
  maximum_output_tokens: number
  timeout_seconds: number
  maximum_attempt_cost_micros: string
  maximum_input_tokens: number
  invocation_deadline: string
  invocation_status: string
  error_code: string | null
}

export type ArchiveReceipt = {
  disposition: "stored" | "duplicate"
  archive_item_id: string
  content_hash: string
}

export type ProviderResult = {
  ok: boolean
  ambiguous: boolean
  status: number
  body: Record<string, JSONValue>
  duration_ms: number
}

export type ToolContext = {
  input: ChatInput
  invocationId: string
  archiveReceiptId: string
}
