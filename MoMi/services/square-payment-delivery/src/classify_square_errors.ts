import type { PaymentReceipt, SquareError } from "./types.ts"

export const classifySquareErrors = (errors: SquareError[]): PaymentReceipt => {
  if (errors.length > 0 && errors.every((error) =>
    error.category === "PAYMENT_METHOD_ERROR"
  )) {
    return {
      outcome: "rejected",
      payment_status: "declined",
      provider_payment_id: null,
      provider_updated_at: null,
      provider_request_id: null,
      recovery: "operator_review",
    }
  }
  return {
    outcome: "indeterminate",
    payment_status: "indeterminate",
    provider_payment_id: null,
    provider_updated_at: null,
    provider_request_id: null,
    recovery: "operator_review",
  }
}
