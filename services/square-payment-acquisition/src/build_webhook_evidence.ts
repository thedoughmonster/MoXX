import { digestEvidenceIdentity } from "./digest_evidence_identity.ts"
import { mapSquarePaymentStatus } from "./map_square_status.ts"
import { mapSquareRefundStatus } from "./map_square_refund_status.ts"
import { retrieveSquarePayment } from "./retrieve_square_payment.ts"
import type {
  AuthenticatedWebhookEvent,
  FinancialEvidence,
  WebhookEvidenceResult,
} from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function buildWebhookEvidence(
  event: AuthenticatedWebhookEvent,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<WebhookEvidenceResult> {
  let evidence: FinancialEvidence
  const evidenceHash = await digestEvidenceIdentity([event.eventId])
  const evidenceId = `square:webhook:sha256:${evidenceHash}`
  if (event.kind === "payment") {
    if (!event.orderId || !uuid.test(event.orderId)) {
      return { evidence: null, retryable: false, errorCode: "unowned_provider_event" }
    }
    evidence = {
      evidence_id: evidenceId,
      source: "webhook", disposition: "matched",
      payment_status: mapSquarePaymentStatus(event.providerStatus),
      provider_payment_id: event.providerPaymentId,
      provider_updated_at: event.providerUpdatedAt,
      order_id: event.orderId, amount_minor: event.amountMinor,
      currency: event.currency, location_id: event.locationId,
    }
    return { evidence, retryable: false, errorCode: null }
  }
  const payment = await retrieveSquarePayment(
    event.providerPaymentId, accessToken, fetcher,
  )
  if (payment.errorCode) {
    return {
      evidence: null,
      retryable: ["provider_indeterminate", "square_http_error", "not_found"]
        .includes(payment.errorCode),
      errorCode: payment.errorCode,
    }
  }
  if (!payment.orderId || !uuid.test(payment.orderId)) {
    return { evidence: null, retryable: false, errorCode: "unowned_provider_event" }
  }
  if (!payment.providerPaymentId || payment.amountMinor === null ||
      !payment.currency || !payment.locationId) {
    return { evidence: null, retryable: false, errorCode: "provider_identity_missing" }
  }
  const matches = payment.providerPaymentId === event.providerPaymentId &&
    payment.amountMinor === event.amountMinor &&
    payment.currency === event.currency &&
    payment.locationId === event.locationId
  evidence = {
    evidence_id: evidenceId,
    source: "webhook", disposition: matches ? "matched" : "mismatch",
    payment_status: mapSquareRefundStatus(event.providerStatus),
    provider_payment_id: event.providerPaymentId,
    provider_updated_at: event.providerUpdatedAt,
    order_id: payment.orderId, amount_minor: payment.amountMinor,
    currency: payment.currency, location_id: payment.locationId,
  }
  return { evidence, retryable: false,
    errorCode: matches ? null : "provider_identity_mismatch" }
}
