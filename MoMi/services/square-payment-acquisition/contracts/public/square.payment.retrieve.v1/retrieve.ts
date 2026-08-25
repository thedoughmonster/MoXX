import { acquireSquarePayment } from "../../../src/acquire_square_payment.ts"
import { buildReconciliationEvidence } from "../../../src/build_reconciliation_evidence.ts"
import type {
  PaymentFinancialEvidence,
  PaymentRetrievalCommand,
  PaymentRetrievalRuntime,
} from "./types.ts"

export async function retrievePayment(
  command: PaymentRetrievalCommand,
  runtime?: PaymentRetrievalRuntime,
): Promise<PaymentFinancialEvidence> {
  const environment = runtime?.environment
  const accessToken = environment?.SQUARE_SANDBOX_ACCESS_TOKEN ??
    Deno.env.get("SQUARE_SANDBOX_ACCESS_TOKEN")
  const configuredLocation = environment?.SQUARE_SANDBOX_LOCATION_ID ??
    Deno.env.get("SQUARE_SANDBOX_LOCATION_ID")
  const usableToken = configuredLocation === command.location_id
    ? accessToken ?? "" : ""
  const observation = await acquireSquarePayment({
    providerPaymentId: command.provider_payment_id,
    orderId: command.order_id,
    amountMinor: command.amount_minor,
    currency: command.currency,
    locationId: command.location_id,
  }, usableToken, runtime?.fetcher)
  const evidence = await buildReconciliationEvidence(observation)
  return { ...evidence, source: "reconciliation" }
}
