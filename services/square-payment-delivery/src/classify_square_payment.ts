import { isPaymentMatch } from "./is_payment_match.ts"
import type { PaymentCommand, PaymentReceipt, SquarePayment } from "./types.ts"

export const classifySquarePayment = (
  payment: SquarePayment,
  command: PaymentCommand,
  locationId: string,
): PaymentReceipt => {
  if (!payment.id || !isPaymentMatch(payment, command, locationId)) {
    return { outcome: "indeterminate", payment_status: "indeterminate", recovery: "operator_review" }
  }
  const provider_payment_id = payment.id
  if (payment.status === "COMPLETED") {
    return { outcome: "accepted", payment_status: "paid", provider_payment_id, recovery: "none" }
  }
  if (payment.status === "APPROVED") {
    return { outcome: "accepted", payment_status: "authorized", provider_payment_id, recovery: "retrieve" }
  }
  if (payment.status === "PENDING") {
    return { outcome: "pending", payment_status: "pending", provider_payment_id, recovery: "retrieve" }
  }
  if (payment.status === "CANCELED") {
    return { outcome: "rejected", payment_status: "canceled", provider_payment_id, recovery: "none" }
  }
  if (payment.status === "FAILED") {
    return { outcome: "rejected", payment_status: "declined", provider_payment_id, recovery: "none" }
  }
  return { outcome: "indeterminate", payment_status: "indeterminate", provider_payment_id, recovery: "retrieve" }
}
