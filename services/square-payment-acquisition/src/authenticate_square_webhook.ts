import type { AuthenticatedWebhookEvent } from "./types.ts"
import { verifySquareWebhookSignature } from "./verify_square_webhook_signature.ts"

export async function authenticateSquareWebhook(
  rawBody: Uint8Array,
  signature: string,
  signatureKey: string,
  notificationUrl: string,
): Promise<AuthenticatedWebhookEvent | null> {
  if (!await verifySquareWebhookSignature(
    rawBody, signature, signatureKey, notificationUrl,
  )) return null
  let envelope: Record<string, unknown>
  try {
    envelope = JSON.parse(new TextDecoder().decode(rawBody)) as Record<string, unknown>
  } catch {
    return null
  }
  const eventId = envelope.event_id
  const eventType = envelope.type
  const data = envelope.data
  if (typeof eventId !== "string" || eventId.length < 1 || eventId.length > 192 ||
      !["payment.created", "payment.updated", "refund.created", "refund.updated"]
        .includes(String(eventType)) || !data || typeof data !== "object" ||
      Array.isArray(data)) return null
  const object = (data as Record<string, unknown>).object
  if (!object || typeof object !== "object" || Array.isArray(object)) return null
  const isPayment = String(eventType).startsWith("payment.")
  const provider = (object as Record<string, unknown>)[isPayment ? "payment" : "refund"]
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) return null
  const record = provider as Record<string, unknown>
  const money = record.amount_money
  if (!money || typeof money !== "object" || Array.isArray(money)) return null
  const amountMinor = (money as Record<string, unknown>).amount
  const currency = (money as Record<string, unknown>).currency
  const providerPaymentId = isPayment ? record.id : record.payment_id
  const providerUpdatedAt = record.updated_at
  const providerStatus = record.status
  const locationId = record.location_id
  const orderId = isPayment && typeof record.reference_id === "string"
    ? record.reference_id : null
  if (typeof providerPaymentId !== "string" || providerPaymentId.length < 1 ||
      providerPaymentId.length > 192 ||
      typeof providerUpdatedAt !== "string" ||
      !Number.isFinite(Date.parse(providerUpdatedAt)) ||
      typeof providerStatus !== "string" || providerStatus.length < 1 ||
      !Number.isSafeInteger(amountMinor) || Number(amountMinor) < 1 ||
      typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) ||
      typeof locationId !== "string" || locationId.length < 1 ||
      locationId.length > 64) return null
  return {
    eventId,
    eventType: eventType as AuthenticatedWebhookEvent["eventType"],
    kind: isPayment ? "payment" : "refund",
    providerPaymentId, providerUpdatedAt, providerStatus, orderId,
    amountMinor: Number(amountMinor), currency, locationId,
  }
}
