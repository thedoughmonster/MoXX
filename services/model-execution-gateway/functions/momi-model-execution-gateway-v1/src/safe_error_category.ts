import type { JSONValue } from "postgres"

export function safeErrorCategory(
  body: Record<string, JSONValue>,
  status: number,
  ambiguous: boolean,
): string | null {
  if (ambiguous) return "provider_transport_ambiguous"
  if (status >= 200 && status < 300) return null
  const error = body.error
  if (error && typeof error === "object" && !Array.isArray(error) &&
      !(error instanceof Date)) {
    const type = (error as Record<string, JSONValue>).type
    if (typeof type === "string" && /^[a-z][a-z0-9_.-]{0,119}$/.test(type)) return type
  }
  return status > 0 ? `provider_http_${status}` : "provider_request_failed"
}
