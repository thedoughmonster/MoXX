import type {
  PaymentClaimResult,
  PaymentEvidence,
  PaymentProjection,
} from "../../../src/payment_types.ts"

export const functionKey = "momi.preorder.payment.reconcile.v1"

export type PaymentReconcileInput = {
  command_id: string
  order_id: string
  expected_order_version: number
  payment_attempt_id: string
}

export type ExpectedPayment = {
  provider_payment_id: string
  order_id: string
  amount_minor: number
  currency: string
  location_id: string
}

export type ReconcileClaimExecution = {
  admitted: boolean
  result: PaymentClaimResult | null
}

export type ReconcileExecution = {
  admitted: boolean
  result: PaymentClaimResult | PaymentProjection | null
}

export type ReconcileDependencies = {
  getLocationId(): string
  claim(
    input: PaymentReconcileInput,
    authority: string,
    locationId: string,
  ): Promise<ReconcileClaimExecution>
  retrieve(expected: ExpectedPayment): Promise<unknown>
  project(
    paymentAttemptId: string,
    claimId: string,
    evidence: PaymentEvidence,
  ): Promise<PaymentProjection>
}
