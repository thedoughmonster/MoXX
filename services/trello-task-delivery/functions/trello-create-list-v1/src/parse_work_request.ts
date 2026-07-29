import type { WorkRequest } from "./types.ts"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseWorkRequest(value: unknown): WorkRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(",") !== "capability_token,operation_id") return null
  if (
    typeof record.operation_id !== "string" || !uuidPattern.test(record.operation_id)
    || typeof record.capability_token !== "string"
    || record.capability_token.length === 0
    || record.capability_token.length > 512
  ) return null
  return { operationId: record.operation_id, capabilityToken: record.capability_token }
}
