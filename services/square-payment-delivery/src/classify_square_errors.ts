import type { PaymentReceipt, SquareError } from "./types.ts"

export const classifySquareErrors = (errors: SquareError[]): PaymentReceipt => {
  if (errors.length > 0 && errors.every((error) =>
    error.category === "PAYMENT_METHOD_ERROR"
  )) {
    return {
      outcome: "rejected",
      payment_status: "declined",
      recovery: "none",
    }
  }
  return {
    outcome: "indeterminate",
    payment_status: "indeterminate",
    recovery: "operator_review",
  }
}
