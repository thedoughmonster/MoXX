import type { JSONValue } from "postgres"

export type CaptureOpenaiMessageRequest = {
  source_account_key: string
  source_user_key: string
  source_conversation_key: string
  source_message_key: string
  sender_role: string
  occurred_at: string
  captured_at?: string
  source_metadata?: Record<string, JSONValue>
  payload: Record<string, JSONValue> | JSONValue[]
  raw_text?: string | null
  idempotency_key: string
  capture_actor?: string | null
  tool_version?: string | null
  model_version?: string | null
  prompt_version?: string | null
  source_parent_message_key?: string | null
}

export type CaptureOpenaiMessageResult = {
  disposition: "stored" | "duplicate"
  archive_item_id: string
  evaluation_job_id: string
}
