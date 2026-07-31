import type { PaymentReconcileInput } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const allowed = new Set([
  "command_id", "order_id", "expected_order_version", "payment_attempt_id",
])

export function parseRequest(value: unknown): PaymentReconcileInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (Object.keys(v).some((key) => !allowed.has(key)) ||
      !uuid.test(String(v.command_id)) || !uuid.test(String(v.order_id)) ||
      !uuid.test(String(v.payment_attempt_id)) ||
      !Number.isInteger(v.expected_order_version) ||
      Number(v.expected_order_version) < 1) return null
  return v as PaymentReconcileInput
}
