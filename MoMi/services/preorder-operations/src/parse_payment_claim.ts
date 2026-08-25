import type { PaymentClaim, PaymentClaimResult } from "./payment_types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parsePaymentClaim(
  result: PaymentClaimResult,
  kind: PaymentClaim["claim_kind"],
): PaymentClaim | null {
  const claim = result.claim
  if (result.disposition !== "claimed" || !claim ||
      claim.claim_kind !== kind || !uuid.test(claim.claim_id) ||
      !uuid.test(claim.payment_attempt_id) || !uuid.test(claim.owner_order_id) ||
      claim.payment_attempt_id !== result.receipt?.payment_attempt_id ||
      claim.owner_order_id !== result.receipt?.order_id ||
      !Number.isSafeInteger(claim.amount_minor) || claim.amount_minor < 1 ||
      claim.currency !== "USD" || typeof claim.location_id !== "string" ||
      claim.location_id.length < 1 ||
      claim.location_id.length > 64 ||
      (claim.provider_payment_id !== null &&
        (typeof claim.provider_payment_id !== "string" ||
          claim.provider_payment_id.length < 1 ||
          claim.provider_payment_id.length > 192))) return null
  return claim
}
