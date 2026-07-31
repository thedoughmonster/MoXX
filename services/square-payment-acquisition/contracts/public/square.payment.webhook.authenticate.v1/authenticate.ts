import { authenticateSquareWebhook } from "../../../src/authenticate_square_webhook.ts"
import { buildWebhookEvidence } from "../../../src/build_webhook_evidence.ts"
import type {
  WebhookAuthenticationCommand,
  WebhookAuthenticationResult,
  WebhookAuthenticationRuntime,
} from "./types.ts"

export async function authenticateWebhookEvidence(
  command: WebhookAuthenticationCommand,
  runtime?: WebhookAuthenticationRuntime,
): Promise<WebhookAuthenticationResult> {
  const environment = runtime?.environment
  const signatureKey = environment?.SQUARE_WEBHOOK_SIGNATURE_KEY ??
    Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY")
  const notificationUrl = environment?.SQUARE_WEBHOOK_NOTIFICATION_URL ??
    Deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL")
  const configuredLocation = environment?.SQUARE_SANDBOX_LOCATION_ID ??
    Deno.env.get("SQUARE_SANDBOX_LOCATION_ID")
  if (!signatureKey || !notificationUrl || !configuredLocation) {
    return { disposition: "unavailable", evidence: null,
      error_code: "webhook_configuration_missing" }
  }
  const event = await authenticateSquareWebhook(
    command.raw_body, command.signature, signatureKey, notificationUrl,
  )
  if (!event) {
    return { disposition: "rejected", evidence: null,
      error_code: "invalid_webhook" }
  }
  if (event.locationId !== configuredLocation) {
    return { disposition: "ignored", evidence: null,
      error_code: "unowned_provider_event" }
  }
  const accessToken = environment?.SQUARE_SANDBOX_ACCESS_TOKEN ??
    Deno.env.get("SQUARE_SANDBOX_ACCESS_TOKEN")
  if (event.kind === "refund" && !accessToken) {
    return { disposition: "unavailable", evidence: null,
      error_code: "provider_configuration_missing" }
  }
  const result = await buildWebhookEvidence(
    event, accessToken ?? "", runtime?.fetcher,
  )
  if (result.evidence?.source === "webhook") {
    return { disposition: "authenticated",
      evidence: { ...result.evidence, source: "webhook" },
      error_code: result.errorCode }
  }
  return { disposition: result.retryable ? "retryable" : "ignored",
    evidence: null, error_code: result.errorCode }
}
