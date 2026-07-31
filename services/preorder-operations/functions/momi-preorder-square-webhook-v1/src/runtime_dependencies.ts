import { authenticateWebhook } from "./authenticate_webhook.ts"
import { captureRawEvidence } from "./capture_raw_evidence.ts"
import { projectPayment } from "./project_payment.ts"
import { readLocationId } from "./read_location_id.ts"
import { resolvePayment } from "./resolve_payment.ts"
import type { WebhookDependencies } from "./types.ts"

export const webhookDependencies: WebhookDependencies = {
  getLocationId: readLocationId,
  authenticate: authenticateWebhook,
  capture: captureRawEvidence,
  resolve: resolvePayment,
  project: projectPayment,
}
