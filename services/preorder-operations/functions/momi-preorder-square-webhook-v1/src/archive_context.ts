import type { PaymentEvidence } from "../../../src/payment_types.ts"
import type {
  WebhookArchiveContext,
  WebhookAuthenticationResult,
} from "./types.ts"

export function archiveContext(
  result: WebhookAuthenticationResult,
  evidence: PaymentEvidence | null,
  rawDigest: string,
  configuredLocation: string,
): WebhookArchiveContext {
  return {
    evidenceId: evidence?.evidence_id ?? `square:webhook:raw:sha256:${rawDigest}`,
    locationId: evidence?.location_id ?? configuredLocation,
    orderId: evidence?.order_id ?? null,
    occurredAt: evidence?.provider_updated_at ?? new Date().toISOString(),
    authenticationDisposition: result.disposition,
  }
}
