import { digestEvidenceIdentity } from "./digest_evidence_identity.ts"
import type { FinancialEvidence, PaymentObservation } from "./types.ts"

export async function buildReconciliationEvidence(
  observation: PaymentObservation,
): Promise<FinancialEvidence> {
  const evidenceHash = await digestEvidenceIdentity([
    observation.providerPaymentId, observation.providerUpdatedAt,
    observation.providerRequestId, observation.paymentStatus,
    observation.disposition, observation.orderId,
    observation.amountMinor, observation.currency, observation.locationId,
  ])
  return {
    evidence_id: `square:reconciliation:sha256:${evidenceHash}`,
    source: "reconciliation",
    disposition: observation.disposition,
    payment_status: observation.paymentStatus,
    provider_payment_id: observation.providerPaymentId,
    provider_updated_at: observation.providerUpdatedAt,
    order_id: observation.orderId,
    amount_minor: observation.amountMinor,
    currency: observation.currency,
    location_id: observation.locationId,
  }
}
