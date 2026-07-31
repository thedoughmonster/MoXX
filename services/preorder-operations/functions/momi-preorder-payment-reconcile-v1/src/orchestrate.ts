import { indeterminatePaymentEvidence } from
  "../../../src/indeterminate_payment_evidence.ts"
import { parsePaymentClaim } from "../../../src/parse_payment_claim.ts"
import { parsePaymentEvidence } from "../../../src/parse_payment_evidence.ts"
import type {
  PaymentReconcileInput,
  ReconcileDependencies,
  ReconcileExecution,
} from "./types.ts"

export async function orchestrate(
  input: PaymentReconcileInput,
  authority: string,
  dependencies: ReconcileDependencies,
): Promise<ReconcileExecution> {
  const locationId = dependencies.getLocationId()
  if (locationId.length < 1 || locationId.length > 64) {
    throw new Error("invalid_payment_location")
  }
  const execution = await dependencies.claim(input, authority, locationId)
  const result = execution.result
  if (!execution.admitted || !result || result.disposition !== "claimed") {
    return execution
  }
  const claim = parsePaymentClaim(result, "reconcile")
  if (!claim?.provider_payment_id) throw new Error("invalid_reconcile_claim")
  let evidence
  try {
    evidence = parsePaymentEvidence(await dependencies.retrieve({
      provider_payment_id: claim.provider_payment_id,
      order_id: claim.owner_order_id,
      amount_minor: claim.amount_minor,
      currency: claim.currency,
      location_id: claim.location_id,
    })) ?? indeterminatePaymentEvidence(claim, "reconciliation")
  } catch {
    evidence = indeterminatePaymentEvidence(claim, "reconciliation")
  }
  return { admitted: true, result: await dependencies.project(
    claim.payment_attempt_id, claim.claim_id, evidence,
  ) }
}
