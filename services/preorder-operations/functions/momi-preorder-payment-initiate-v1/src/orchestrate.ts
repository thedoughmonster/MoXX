import { indeterminatePaymentEvidence } from
  "../../../src/indeterminate_payment_evidence.ts"
import { parsePaymentClaim } from "../../../src/parse_payment_claim.ts"
import { parsePaymentEvidence } from "../../../src/parse_payment_evidence.ts"
import type {
  InitiateDependencies,
  InitiateExecution,
  PaymentInitiateInput,
} from "./types.ts"

export async function orchestrate(
  input: PaymentInitiateInput,
  authority: string,
  dependencies: InitiateDependencies,
): Promise<InitiateExecution> {
  const locationId = dependencies.getLocationId()
  if (locationId.length < 1 || locationId.length > 64) {
    throw new Error("invalid_payment_location")
  }
  const { source_token, ...claimInput } = input
  const execution = await dependencies.claim(claimInput, authority, locationId)
  const result = execution.result
  if (!execution.admitted || !result || result.disposition !== "claimed") {
    return execution
  }
  const claim = parsePaymentClaim(result, "initiate")
  if (!claim) throw new Error("invalid_payment_claim")
  let evidence
  try {
    evidence = parsePaymentEvidence(await dependencies.deliver({
      payment_attempt_id: claim.payment_attempt_id,
      owner_order_id: claim.owner_order_id,
      location_id: claim.location_id,
      amount_minor: claim.amount_minor,
      currency: "USD",
      source_token,
    })) ?? indeterminatePaymentEvidence(claim, "delivery")
  } catch {
    evidence = indeterminatePaymentEvidence(claim, "delivery")
  }
  return {
    admitted: true,
    result: await dependencies.project(
      claim.payment_attempt_id, claim.claim_id, evidence,
    ),
  }
}
