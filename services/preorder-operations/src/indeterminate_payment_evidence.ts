import type { PaymentClaim, PaymentEvidence } from "./payment_types.ts"

export function indeterminatePaymentEvidence(
  claim: PaymentClaim,
  source: "delivery" | "reconciliation",
): PaymentEvidence {
  return {
    evidence_id: `momi:${source}:indeterminate:${claim.claim_id}`,
    source,
    disposition: "indeterminate",
    payment_status: "indeterminate",
    provider_payment_id: claim.provider_payment_id,
    provider_updated_at: null,
    order_id: claim.owner_order_id,
    amount_minor: claim.amount_minor,
    currency: claim.currency,
    location_id: claim.location_id,
  }
}
