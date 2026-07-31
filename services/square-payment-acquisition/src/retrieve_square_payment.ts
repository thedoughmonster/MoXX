import { SQUARE_API_VERSION, SQUARE_SANDBOX_API_ORIGIN } from "./constants.ts"
import type { ProviderPayment } from "./types.ts"

export async function retrieveSquarePayment(
  providerPaymentId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderPayment> {
  if (!providerPaymentId || providerPaymentId.length > 192 || !accessToken) {
    return { providerPaymentId, providerUpdatedAt: null, providerStatus: null,
      providerRequestId: null, orderId: null, amountMinor: null,
      currency: null, locationId: null,
      errorCode: "invalid_observation_request" }
  }
  let response: Response
  try {
    const encodedId = encodeURIComponent(providerPaymentId)
    response = await fetcher(`${SQUARE_SANDBOX_API_ORIGIN}/v2/payments/${encodedId}`, {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: "application/json", Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
      },
    })
  } catch {
    return { providerPaymentId, providerUpdatedAt: null, providerStatus: null,
      providerRequestId: null, orderId: null, amountMinor: null,
      currency: null, locationId: null, errorCode: "provider_indeterminate" }
  }
  const providerRequestId = response.headers.get("x-request-id")
  let body: Record<string, unknown>
  try {
    body = await response.json() as Record<string, unknown>
  } catch {
    return { providerPaymentId, providerUpdatedAt: null, providerStatus: null,
      providerRequestId, orderId: null, amountMinor: null,
      currency: null, locationId: null, errorCode: "provider_indeterminate" }
  }
  if (response.status === 404) {
    return { providerPaymentId, providerUpdatedAt: null, providerStatus: null,
      providerRequestId, orderId: null, amountMinor: null,
      currency: null, locationId: null, errorCode: "not_found" }
  }
  const payment = body.payment
  if (!response.ok || !payment || typeof payment !== "object" || Array.isArray(payment)) {
    return { providerPaymentId, providerUpdatedAt: null, providerStatus: null,
      providerRequestId, orderId: null, amountMinor: null,
      currency: null, locationId: null, errorCode: "square_http_error" }
  }
  const record = payment as Record<string, unknown>
  const money = record.amount_money as Record<string, unknown> | undefined
  return {
    providerPaymentId: typeof record.id === "string" ? record.id : null,
    providerUpdatedAt: typeof record.updated_at === "string" ? record.updated_at : null,
    providerStatus: typeof record.status === "string" ? record.status : null,
    providerRequestId,
    orderId: typeof record.reference_id === "string" ? record.reference_id : null,
    amountMinor: typeof money?.amount === "number" ? money.amount : null,
    currency: typeof money?.currency === "string" ? money.currency : null,
    locationId: typeof record.location_id === "string" ? record.location_id : null,
    errorCode: null,
  }
}
