import type { PaymentEvidence } from "./payment_types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const statuses = new Set([
  "pending", "authorized", "paid", "declined", "canceled",
  "refund_pending", "refunded", "indeterminate",
])
const sources = new Set(["delivery", "reconciliation", "webhook"])
const dispositions = new Set(["matched", "mismatch", "missing", "indeterminate"])
const allowed = new Set([
  "evidence_id", "source", "disposition", "payment_status",
  "provider_payment_id", "provider_updated_at", "order_id", "amount_minor",
  "currency", "location_id",
])

export function parsePaymentEvidence(value: unknown): PaymentEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const providerId = v.provider_payment_id
  const updatedAt = v.provider_updated_at
  if (Object.keys(v).some((key) => !allowed.has(key)) ||
      typeof v.evidence_id !== "string" || v.evidence_id.length < 1 ||
      v.evidence_id.length > 192 || !sources.has(String(v.source)) ||
      !dispositions.has(String(v.disposition)) ||
      !statuses.has(String(v.payment_status)) ||
      (providerId !== null && (typeof providerId !== "string" ||
        providerId.length < 1 || providerId.length > 192)) ||
      (updatedAt !== null && (typeof updatedAt !== "string" ||
        !Number.isFinite(Date.parse(updatedAt)))) ||
      typeof v.order_id !== "string" || !uuid.test(v.order_id) ||
      !Number.isSafeInteger(v.amount_minor) || Number(v.amount_minor) < 1 ||
      typeof v.currency !== "string" || !/^[A-Z]{3}$/.test(v.currency) ||
      typeof v.location_id !== "string" || v.location_id.length < 1 ||
      v.location_id.length > 64) return null
  return v as PaymentEvidence
}
