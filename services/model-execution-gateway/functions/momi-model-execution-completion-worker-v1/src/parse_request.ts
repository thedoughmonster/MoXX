import type { CompletionInput } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export function parseCompletionInput(value: unknown): CompletionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !["work_id", "capability_token"].includes(key)) ||
    typeof record.work_id !== "string" || !uuid.test(record.work_id) ||
    typeof record.capability_token !== "string" || !uuid.test(record.capability_token)) {
    return null
  }
  return { work_id: record.work_id, capability_token: record.capability_token }
}
