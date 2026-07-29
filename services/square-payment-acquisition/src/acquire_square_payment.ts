import { SQUARE_API_VERSION, SQUARE_SANDBOX_API_ORIGIN } from "./constants.ts"
import type { ExpectedPayment, PaymentObservation } from "./types.ts"

export async function acquireSquarePayment(
  expected: ExpectedPayment,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<PaymentObservation> {
  const indeterminate: PaymentObservation = {
    disposition: "indeterminate", providerPaymentId: expected.providerPaymentId,
    providerStatus: null, providerRequestId: null, errorCode: "provider_indeterminate",
  }
  if (!expected.providerPaymentId || !accessToken || !Number.isSafeInteger(expected.amountMinor)) {
    return { ...indeterminate, errorCode: "invalid_observation_request" }
  }
  let response: Response
  try {
    const encodedId = encodeURIComponent(expected.providerPaymentId)
    response = await fetcher(`${SQUARE_SANDBOX_API_ORIGIN}/v2/payments/${encodedId}`, {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: "application/json", Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
      },
    })
  } catch {
    return indeterminate
  }
  const providerRequestId = response.headers.get("x-request-id")
  if (response.status === 404) {
    return { ...indeterminate, disposition: "missing", providerRequestId, errorCode: "not_found" }
  }
  let body: Record<string, unknown>
  try {
    body = await response.json() as Record<string, unknown>
  } catch {
    return { ...indeterminate, providerRequestId }
  }
  const payment = body.payment
  if (!response.ok || !payment || typeof payment !== "object" || Array.isArray(payment)) {
    return { ...indeterminate, providerRequestId, errorCode: "square_http_error" }
  }
  const record = payment as Record<string, unknown>
  const money = record.amount_money as Record<string, unknown> | undefined
  const providerStatus = typeof record.status === "string" ? record.status : null
  const matches = record.id === expected.providerPaymentId
    && record.reference_id === expected.orderId
    && record.location_id === expected.locationId
    && money?.amount === expected.amountMinor
    && money?.currency === expected.currency
    && providerStatus !== null
  return {
    disposition: matches ? "matched" : "mismatch",
    providerPaymentId: expected.providerPaymentId, providerStatus,
    providerRequestId,
    errorCode: matches ? null : "provider_identity_mismatch",
  }
}
