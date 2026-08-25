import { classifySquareErrors } from "./classify_square_errors.ts"
import { classifySquarePayment } from "./classify_square_payment.ts"
import type { PaymentCommand, PaymentReceipt, SquareEnvelope } from "./types.ts"

export const classifySquareEnvelope = (
  envelope: SquareEnvelope,
  command: PaymentCommand,
  locationId: string,
): PaymentReceipt => {
  if (envelope.payment) return classifySquarePayment(envelope.payment, command, locationId)
  if (envelope.errors?.length) return classifySquareErrors(envelope.errors)
  return {
    outcome: "indeterminate",
    payment_status: "indeterminate",
    provider_payment_id: null,
    provider_updated_at: null,
    provider_request_id: null,
    recovery: "operator_review",
  }
}
