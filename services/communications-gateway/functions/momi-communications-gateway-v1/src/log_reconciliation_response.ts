import type { JSONValue } from "postgres"

export function logReconciliationResponse(id: string): {
  status: number
  body: Record<string, JSONValue>
} {
  return { status: 409, body: {
    id,
    object: "momi.log",
    model: "momi-assistant",
    status: "reconciling",
    error: "log_reconciliation_in_progress",
  } }
}
