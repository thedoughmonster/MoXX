import type {
  PaymentClaimResult,
  PaymentEvidence,
  PaymentProjection,
} from "../../../src/payment_types.ts"

export const functionKey = "momi.preorder.payment.initiate.v1"

export type PaymentInitiateInput = {
  command_id: string
  order_id: string
  expected_order_version: number
  source_token: string
}

export type PaymentInitiateClaimInput = Omit<PaymentInitiateInput, "source_token">

export type PaymentCommand = {
  payment_attempt_id: string
  owner_order_id: string
  amount_minor: number
  currency: "USD"
  location_id: string
  source_token: string
}

export type InitiateClaimExecution = {
  admitted: boolean
  result: PaymentClaimResult | null
}

export type InitiateExecution = {
  admitted: boolean
  result: PaymentClaimResult | PaymentProjection | null
}

export type InitiateDependencies = {
  getLocationId(): string
  claim(
    input: PaymentInitiateClaimInput,
    authority: string,
    locationId: string,
  ): Promise<InitiateClaimExecution>
  deliver(command: PaymentCommand): Promise<unknown>
  project(
    paymentAttemptId: string,
    claimId: string,
    evidence: PaymentEvidence,
  ): Promise<PaymentProjection>
}
