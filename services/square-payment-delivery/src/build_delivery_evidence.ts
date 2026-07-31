import { digestEvidenceIdentity } from "./digest_evidence_identity.ts"
import type {
  FinancialEvidence,
  PaymentCommand,
  PaymentReceipt,
} from "./types.ts"

export async function buildDeliveryEvidence(
  command: PaymentCommand,
  locationId: string,
  receipt: PaymentReceipt,
): Promise<FinancialEvidence> {
  const hasCanonicalProviderFact = Boolean(
    receipt.provider_payment_id && receipt.provider_updated_at,
  )
  const disposition = hasCanonicalProviderFact
    ? (receipt.recovery === "operator_review" ? "mismatch" : "matched")
    : "indeterminate"
  const evidenceHash = await digestEvidenceIdentity([
    command.payment_attempt_id, receipt.provider_payment_id,
    receipt.provider_updated_at, receipt.provider_request_id,
    receipt.payment_status, disposition,
  ])
  return {
    evidence_id: `square:delivery:sha256:${evidenceHash}`,
    source: "delivery", disposition,
    payment_status: receipt.payment_status,
    provider_payment_id: receipt.provider_payment_id,
    provider_updated_at: receipt.provider_updated_at,
    order_id: command.owner_order_id,
    amount_minor: command.amount_minor,
    currency: command.currency,
    location_id: locationId,
  }
}
