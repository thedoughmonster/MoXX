import type { WebhookAuthenticationResult as SquareAuthenticationResult } from
  "../../../../square-payment-acquisition/contracts/public/square.payment.webhook.authenticate.v1/index.ts"
import type { PaymentEvidence, PaymentProjection } from
  "../../../src/payment_types.ts"

export const functionKey = "momi.preorder.square_webhook.process.v1"

export type JsonValue = string | number | boolean | null | JsonValue[] |
  { [key: string]: JsonValue }
export type JsonRecord = { [key: string]: JsonValue }
export type WebhookAuthenticationResult = SquareAuthenticationResult

export type WebhookArchiveContext = {
  evidenceId: string
  locationId: string
  orderId: string | null
  occurredAt: string
  authenticationDisposition: WebhookAuthenticationResult["disposition"]
}

export type CaptureReceipt = {
  disposition: "stored" | "duplicate"
  archiveItemId: string
  contentHash: string
}

export type WebhookDependencies = {
  getLocationId(): string
  authenticate(
    rawBody: Uint8Array,
    signature: string,
  ): Promise<WebhookAuthenticationResult>
  capture(
    rawText: string,
    payload: JsonRecord,
    context: WebhookArchiveContext,
  ): Promise<CaptureReceipt>
  resolve(evidence: PaymentEvidence): Promise<string | null>
  project(
    paymentAttemptId: string,
    evidence: PaymentEvidence,
  ): Promise<PaymentProjection>
}
