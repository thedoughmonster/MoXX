import type { PaymentCommand } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const assertPaymentCommand = (command: PaymentCommand): void => {
  if (!uuid.test(command.payment_attempt_id) || !uuid.test(command.momi_order_id)) {
    throw new Error("invalid_payment_identity")
  }
  if (!Number.isSafeInteger(command.amount_minor) || command.amount_minor < 1) {
    throw new Error("invalid_payment_amount")
  }
  if (command.currency !== "USD") throw new Error("invalid_payment_currency")
  if (!command.source_token || command.source_token.length > 512) {
    throw new Error("invalid_payment_source")
  }
}
