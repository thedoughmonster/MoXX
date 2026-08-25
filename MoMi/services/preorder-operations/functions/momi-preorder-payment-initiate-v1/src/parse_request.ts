import type { PaymentInitiateInput } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const allowed = new Set([
  "command_id", "order_id", "expected_order_version", "source_token",
])

export function parseRequest(value: unknown): PaymentInitiateInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (Object.keys(v).some((key) => !allowed.has(key)) ||
      !uuid.test(String(v.command_id)) || !uuid.test(String(v.order_id)) ||
      !Number.isInteger(v.expected_order_version) ||
      Number(v.expected_order_version) < 1 ||
      typeof v.source_token !== "string" || v.source_token.length < 1 ||
      v.source_token.length > 512) return null
  return v as PaymentInitiateInput
}
