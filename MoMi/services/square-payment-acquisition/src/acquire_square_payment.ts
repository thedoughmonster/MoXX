import { mapSquarePaymentStatus } from "./map_square_status.ts"
import { retrieveSquarePayment } from "./retrieve_square_payment.ts"
import type { ExpectedPayment, PaymentObservation } from "./types.ts"

export async function acquireSquarePayment(
  expected: ExpectedPayment,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<PaymentObservation> {
  const indeterminate: PaymentObservation = {
    disposition: "indeterminate", providerPaymentId: expected.providerPaymentId,
    providerUpdatedAt: null, providerStatus: null, providerRequestId: null,
    paymentStatus: "indeterminate", orderId: expected.orderId,
    amountMinor: expected.amountMinor, currency: expected.currency,
    locationId: expected.locationId, errorCode: "provider_indeterminate",
  }
  if (!expected.providerPaymentId || !accessToken || !Number.isSafeInteger(expected.amountMinor)) {
    return { ...indeterminate, errorCode: "invalid_observation_request" }
  }
  const payment = await retrieveSquarePayment(expected.providerPaymentId, accessToken, fetcher)
  if (payment.errorCode === "not_found") {
    return { ...indeterminate, disposition: "missing", errorCode: "not_found",
      providerRequestId: payment.providerRequestId }
  }
  if (payment.errorCode) {
    return { ...indeterminate, errorCode: payment.errorCode,
      providerRequestId: payment.providerRequestId }
  }
  const matches = payment.providerPaymentId === expected.providerPaymentId
    && payment.orderId === expected.orderId
    && payment.locationId === expected.locationId
    && payment.amountMinor === expected.amountMinor
    && payment.currency === expected.currency
    && payment.providerStatus !== null
    && payment.providerUpdatedAt !== null
  return {
    disposition: matches ? "matched" : "mismatch",
    providerPaymentId: expected.providerPaymentId,
    providerUpdatedAt: payment.providerUpdatedAt,
    providerStatus: payment.providerStatus,
    providerRequestId: payment.providerRequestId,
    paymentStatus: mapSquarePaymentStatus(payment.providerStatus),
    orderId: expected.orderId, amountMinor: expected.amountMinor,
    currency: expected.currency, locationId: expected.locationId,
    errorCode: matches ? null : "provider_identity_mismatch",
  }
}
