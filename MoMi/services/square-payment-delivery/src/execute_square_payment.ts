import { squareCreatePaymentPath, squareSandboxOrigin } from "./constants.ts"
import { assertPaymentCommand } from "./assert_payment_command.ts"
import { classifySquareEnvelope } from "./classify_square_envelope.ts"
import type { PaymentCommand, PaymentReceipt, SquareEnvelope } from "./types.ts"

export const executeSquarePayment = async (
  command: PaymentCommand,
  locationId: string,
  accessToken: string,
  apiVersion: string,
  fetcher: typeof fetch = fetch,
): Promise<PaymentReceipt> => {
  assertPaymentCommand(command)
  if (!locationId || !accessToken || !/^20\d{2}-\d{2}-\d{2}$/.test(apiVersion)) {
    throw new Error("invalid_square_configuration")
  }
  const init: RequestInit = {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": apiVersion,
    },
    body: JSON.stringify({
      source_id: command.source_token,
      idempotency_key: command.payment_attempt_id,
      amount_money: { amount: command.amount_minor, currency: command.currency },
      autocomplete: true,
      location_id: locationId,
      reference_id: command.owner_order_id,
    }),
  }
  try {
    const response = await fetcher(`${squareSandboxOrigin}${squareCreatePaymentPath}`, init)
    const envelope = await response.json() as SquareEnvelope
    const provider_request_id = response.headers.get("x-request-id")
    if (!response.ok) {
      return {
        ...classifySquareEnvelope({ errors: envelope.errors }, command, locationId),
        provider_request_id,
      }
    }
    return { ...classifySquareEnvelope(envelope, command, locationId), provider_request_id }
  } catch {
    return {
      outcome: "indeterminate", payment_status: "indeterminate",
      provider_payment_id: null, provider_updated_at: null,
      provider_request_id: null, recovery: "retrieve",
    }
  }
}
