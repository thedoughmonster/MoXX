// service-owner: square-payment-acquisition

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
  providerStatus: string | null
  providerRequestId: string | null
  errorCode: string | null
}
