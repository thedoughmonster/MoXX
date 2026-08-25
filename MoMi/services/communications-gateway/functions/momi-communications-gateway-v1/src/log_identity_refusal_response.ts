import type { JSONValue } from "postgres"

export function logIdentityRefusalResponse(id: string): {
  status: number
  body: Record<string, JSONValue>
} {
  return { status: 409, body: {
    id,
    object: "momi.log",
    model: "momi-assistant",
    status: "refused",
    error: "log_source_identity_unavailable",
  } }
}
