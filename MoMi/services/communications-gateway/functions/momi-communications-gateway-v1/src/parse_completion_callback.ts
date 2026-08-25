const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export function parseCompletionCallback(value: unknown): {
  call_id: string; provider_response_id: string
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => ![
      "schema_version", "call_id", "provider_response_id",
    ].includes(key)) || record.schema_version !== 1 ||
    typeof record.call_id !== "string" || !uuid.test(record.call_id) ||
    typeof record.provider_response_id !== "string" ||
    !/^resp_[A-Za-z0-9_-]+$/.test(record.provider_response_id) ||
    record.provider_response_id.length > 240) return null
  return { call_id: record.call_id, provider_response_id: record.provider_response_id }
}
