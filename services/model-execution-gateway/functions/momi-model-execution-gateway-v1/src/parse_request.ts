import type { CreateRequest, ExecutionRequest, RetrieveRequest } from "./types.ts"

const createKeys = ["background", "deadline_at", "idempotency_key", "operation",
  "parent_invocation_id", "payload", "profile_key", "purpose_key",
  "requested_output_tokens", "schema_version"].sort().join(",")
const retrieveKeys = ["call_id", "deadline_at", "operation",
  "provider_response_id", "schema_version"].sort().join(",")
const payloadKeys = new Set(["include", "input", "instructions", "metadata",
  "parallel_tool_calls", "previous_response_id", "safety_identifier", "text",
  "tool_choice", "tools"])
const keyPattern = /^[a-z][a-z0-9_.-]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseRequest(value: unknown): ExecutionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (item.schema_version !== 1 || typeof item.operation !== "string") return null
  const deadline = typeof item.deadline_at === "string" ? Date.parse(item.deadline_at) : NaN
  if (!Number.isFinite(deadline) || deadline <= Date.now()) return null
  const keys = Object.keys(item).sort().join(",")
  if (item.operation === "retrieve") {
    if (keys !== retrieveKeys || typeof item.call_id !== "string" ||
      !uuidPattern.test(item.call_id) || typeof item.provider_response_id !== "string" ||
      !item.provider_response_id || item.provider_response_id.length > 240) return null
    return item as RetrieveRequest
  }
  if (item.operation !== "create" || keys !== createKeys ||
    typeof item.purpose_key !== "string" || !keyPattern.test(item.purpose_key) ||
    typeof item.profile_key !== "string" || !keyPattern.test(item.profile_key) ||
    typeof item.parent_invocation_id !== "string" || !item.parent_invocation_id ||
    item.parent_invocation_id.length > 240 || typeof item.idempotency_key !== "string" ||
    !item.idempotency_key || item.idempotency_key.length > 240 ||
    !Number.isInteger(item.requested_output_tokens) ||
    (item.requested_output_tokens as number) < 1 ||
    (item.requested_output_tokens as number) > 32000 ||
    typeof item.background !== "boolean" || !item.payload ||
    typeof item.payload !== "object" || Array.isArray(item.payload)) return null
  if (Object.keys(item.payload).some((key) => !payloadKeys.has(key))) return null
  return item as CreateRequest
}
