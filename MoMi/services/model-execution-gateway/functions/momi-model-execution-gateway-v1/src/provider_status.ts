import type { JSONValue } from "postgres"

export function providerStatus(
  body: Record<string, JSONValue>,
  ok: boolean,
  ambiguous: boolean,
): "pending" | "completed" | "failed" | "paid_ambiguous" |
  "cancelled" | "expired" {
  if (ambiguous) return "paid_ambiguous"
  if (!ok) return "failed"
  if (body.status === "queued" || body.status === "in_progress") return "pending"
  if (body.status === "cancelled") return "cancelled"
  if (body.status === "expired") return "expired"
  return body.status === "completed" ? "completed" : "failed"
}
