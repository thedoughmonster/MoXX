import { buildDeliveryEvidence } from "../../../src/build_delivery_evidence.ts"
import { executeSquarePayment } from "../../../src/execute_square_payment.ts"
import type { PaymentReceipt } from "../../../src/types.ts"
import type {
  PaymentExecutionCommand,
  PaymentExecutionRuntime,
  PaymentFinancialEvidence,
} from "./types.ts"

export async function executePayment(
  command: PaymentExecutionCommand,
  runtime?: PaymentExecutionRuntime,
): Promise<PaymentFinancialEvidence> {
  const environment = runtime?.environment
  const accessToken = environment?.SQUARE_SANDBOX_ACCESS_TOKEN ??
    Deno.env.get("SQUARE_SANDBOX_ACCESS_TOKEN")
  const configuredLocation = environment?.SQUARE_SANDBOX_LOCATION_ID ??
    Deno.env.get("SQUARE_SANDBOX_LOCATION_ID")
  const apiVersion = environment?.SQUARE_API_VERSION ??
    Deno.env.get("SQUARE_API_VERSION") ?? "2026-07-15"
  let receipt: PaymentReceipt
  if (!accessToken || configuredLocation !== command.location_id) {
    receipt = {
      outcome: "indeterminate", payment_status: "indeterminate",
      provider_payment_id: null, provider_updated_at: null,
      provider_request_id: null, recovery: "operator_review",
    }
  } else {
    receipt = await executeSquarePayment({
      payment_attempt_id: command.payment_attempt_id,
      owner_order_id: command.owner_order_id,
      amount_minor: command.amount_minor,
      currency: command.currency,
      source_token: command.source_token,
    }, command.location_id, accessToken, apiVersion, runtime?.fetcher)
  }
  return await buildDeliveryEvidence(command, command.location_id, receipt)
}
