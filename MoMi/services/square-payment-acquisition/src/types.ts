// service-owner: square-payment-acquisition

export type PaymentStatus = "pending" | "authorized" | "paid" | "declined" |
  "canceled" | "refund_pending" | "refunded" | "indeterminate"

export type ExpectedPayment = {
  providerPaymentId: string
  orderId: string
  amountMinor: number
  currency: string
  locationId: string
}

export type ObservationDisposition =
  | "matched"
  | "mismatch"
  | "missing"
  | "indeterminate"

export type PaymentObservation = {
  disposition: ObservationDisposition
  providerPaymentId: string
  providerUpdatedAt: string | null
  providerStatus: string | null
  providerRequestId: string | null
  paymentStatus: PaymentStatus
  orderId: string
  amountMinor: number
  currency: string
  locationId: string
  errorCode: string | null
}

export type ProviderPayment = {
  providerPaymentId: string | null
  providerUpdatedAt: string | null
  providerStatus: string | null
  providerRequestId: string | null
  orderId: string | null
  amountMinor: number | null
  currency: string | null
  locationId: string | null
  errorCode: string | null
}

export type FinancialEvidence = {
  evidence_id: string
  source: "reconciliation" | "webhook"
  disposition: ObservationDisposition
  payment_status: PaymentStatus
  provider_payment_id: string | null
  provider_updated_at: string | null
  order_id: string
  amount_minor: number
  currency: string
  location_id: string
}

export type AuthenticatedWebhookEvent = {
  eventId: string
  eventType: "payment.created" | "payment.updated" |
    "refund.created" | "refund.updated"
  kind: "payment" | "refund"
  providerPaymentId: string
  providerUpdatedAt: string
  providerStatus: string
  orderId: string | null
  amountMinor: number
  currency: string
  locationId: string
}

export type WebhookEvidenceResult = {
  evidence: FinancialEvidence | null
  retryable: boolean
  errorCode: string | null
}
