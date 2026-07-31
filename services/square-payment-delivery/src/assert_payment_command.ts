import type { PaymentCommand } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const assertPaymentCommand = (command: PaymentCommand): void => {
  if (!uuid.test(command.payment_attempt_id) || !uuid.test(command.owner_order_id)) {
    throw new Error("invalid_payment_identity")
  }
  const failure = [
    [!Number.isSafeInteger(command.amount_minor) || command.amount_minor < 1, "invalid_payment_amount"],
    [command.currency !== "USD", "invalid_payment_currency"],
    [!command.source_token || command.source_token.length > 512, "invalid_payment_source"],
  ].find(([invalid]) => invalid)?.[1]
  if (failure) throw new Error(String(failure))
}
