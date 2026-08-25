import type { CaptureOpenaiMessageRequest } from "./types.ts"

const allowedKeys = new Set([
  "source_account_key",
  "source_user_key",
  "source_conversation_key",
  "source_message_key",
  "sender_role",
  "occurred_at",
  "captured_at",
  "source_metadata",
  "payload",
  "raw_text",
  "idempotency_key",
  "capture_actor",
  "tool_version",
  "model_version",
  "prompt_version",
  "source_parent_message_key",
])
const requiredStringKeys = [
  "source_account_key",
  "source_user_key",
  "source_conversation_key",
  "source_message_key",
  "sender_role",
  "occurred_at",
  "idempotency_key",
] as const
const nullableStringKeys = [
  "source_parent_message_key",
  "raw_text",
  "capture_actor",
  "tool_version",
  "model_version",
  "prompt_version",
] as const
const dateKeys = ["occurred_at", "captured_at"] as const

export function parseRequest(value: unknown): CaptureOpenaiMessageRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return null
  }
  if (requiredStringKeys.some((key) =>
    typeof record[key] !== "string" || (record[key] as string).trim() === ""
  )) {
    return null
  }
  if (nullableStringKeys.some((key) =>
    record[key] !== undefined && record[key] !== null &&
    typeof record[key] !== "string"
  )) {
    return null
  }
  if (dateKeys.some((key) =>
    record[key] !== undefined &&
    (typeof record[key] !== "string" || Number.isNaN(Date.parse(record[key])))
  )) {
    return null
  }
  if (typeof record.payload !== "object" || record.payload === null) {
    return null
  }
  if (
    record.source_metadata !== undefined &&
    (typeof record.source_metadata !== "object" ||
      record.source_metadata === null ||
      Array.isArray(record.source_metadata))
  ) {
    return null
  }
  return record as CaptureOpenaiMessageRequest
}
