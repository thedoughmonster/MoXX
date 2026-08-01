import { authenticateWebhookEvidence } from
  "../../../../square-payment-acquisition/contracts/public/square.payment.webhook.authenticate.v1/index.ts"
import type { WebhookAuthenticationResult } from "./types.ts"

export async function authenticateWebhook(
  rawBody: Uint8Array,
  signature: string,
): Promise<WebhookAuthenticationResult> {
  return await authenticateWebhookEvidence({
    raw_body: rawBody,
    signature,
  })
}
