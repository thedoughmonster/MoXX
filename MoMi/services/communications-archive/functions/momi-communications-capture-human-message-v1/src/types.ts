import type { JSONValue } from "postgres"

export type HumanMessageInput = {
  source_account_key: string
  source_user_key: string
  source_conversation_key: string
  source_message_key: string
  source_parent_message_key?: string | null
  sender_role: "user" | "assistant"
  content: string
  source_metadata: Record<string, JSONValue>
  idempotency_key: string
  occurred_at: string
}

export type HumanMessageReceipt = {
  disposition: "stored" | "duplicate"
  archive_item_id: string
  content_hash: string
}
