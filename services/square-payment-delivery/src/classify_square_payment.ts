import { isPaymentMatch } from "./is_payment_match.ts"
import type { PaymentCommand, PaymentReceipt, SquarePayment } from "./types.ts"

export const classifySquarePayment = (
  payment: SquarePayment,
  command: PaymentCommand,
  locationId: string,
): PaymentReceipt => {
  const provider_updated_at = payment.updated_at &&
      Number.isFinite(Date.parse(payment.updated_at))
    ? payment.updated_at : null
  if (!payment.id || !provider_updated_at ||
      !isPaymentMatch(payment, command, locationId)) {
    return {
      outcome: "indeterminate", payment_status: "indeterminate",
      provider_payment_id: payment.id ?? null, provider_updated_at,
      provider_request_id: null, recovery: "operator_review",
    }
  }
  const provider_payment_id = payment.id
  const provider = { provider_payment_id, provider_updated_at, provider_request_id: null }
  if (payment.status === "COMPLETED") {
    return { outcome: "accepted", payment_status: "paid", ...provider, recovery: "none" }
  }
  if (payment.status === "APPROVED") {
    return { outcome: "accepted", payment_status: "authorized", ...provider, recovery: "retrieve" }
  }
  if (payment.status === "PENDING") {
    return { outcome: "pending", payment_status: "pending", ...provider, recovery: "retrieve" }
  }
  if (payment.status === "CANCELED") {
    return { outcome: "rejected", payment_status: "canceled", ...provider, recovery: "none" }
  }
  if (payment.status === "FAILED") {
    return { outcome: "rejected", payment_status: "declined", ...provider, recovery: "none" }
  }
  return { outcome: "indeterminate", payment_status: "indeterminate", ...provider, recovery: "retrieve" }
}
