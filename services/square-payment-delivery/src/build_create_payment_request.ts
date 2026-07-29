import { squareCreatePaymentPath, squareSandboxOrigin } from "./constants.ts"
import { assertPaymentCommand } from "./assert_payment_command.ts"
import type { PaymentCommand, SquareRequest } from "./types.ts"

export const buildCreatePaymentRequest = (
  command: PaymentCommand,
  locationId: string,
  accessToken: string,
  apiVersion: string,
): SquareRequest => {
  assertPaymentCommand(command)
  if (!locationId || !accessToken || !/^20\d{2}-\d{2}-\d{2}$/.test(apiVersion)) {
    throw new Error("invalid_square_configuration")
  }
  return {
    url: `${squareSandboxOrigin}${squareCreatePaymentPath}`,
    init: {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": apiVersion,
      },
      body: JSON.stringify({
        source_id: command.source_token,
        idempotency_key: command.payment_attempt_id,
        amount_money: {
          amount: command.amount_minor,
          currency: command.currency,
        },
        autocomplete: true,
        location_id: locationId,
        reference_id: command.momi_order_id,
      }),
    },
  }
}
