import type { RefundCommand, RefundReceipt, SquareRefund } from "./types.ts"

export function classifySquareRefund(
  refund: SquareRefund,
  command: RefundCommand,
): RefundReceipt {
  const money = refund.amount_money
  const provider_updated_at = refund.updated_at &&
      Number.isFinite(Date.parse(refund.updated_at))
    ? refund.updated_at : null
  const matches = refund.id && refund.payment_id === command.provider_payment_id &&
    refund.location_id === command.location_id &&
    money?.amount === command.amount_minor && money.currency === command.currency &&
    provider_updated_at
  const base = {
    provider_payment_id: command.provider_payment_id,
    provider_refund_id: refund.id ?? null,
    provider_updated_at,
    provider_request_id: null,
  }
  if (!matches) return {
    outcome: "indeterminate", payment_status: "indeterminate", ...base,
    recovery: "operator_review",
  }
  if (refund.status === "PENDING") return {
    outcome: "pending", payment_status: "refund_pending", ...base,
    recovery: "retrieve",
  }
  if (refund.status === "APPROVED" || refund.status === "COMPLETED") return {
    outcome: "accepted", payment_status: "refunded", ...base, recovery: "none",
  }
  if (refund.status === "REJECTED" || refund.status === "FAILED") return {
    outcome: "rejected", payment_status: "paid", ...base,
    recovery: "operator_review",
  }
  return { outcome: "indeterminate", payment_status: "indeterminate", ...base,
    recovery: "retrieve" }
}
