import { sql } from "./database.ts"
import { storeRawWebhookEvent } from "./store_raw_webhook_event.ts"
import type { IngestionDependencies } from "./types.ts"

export const ingestionDependencies: IngestionDependencies = {
  getSecret(secretName) {
    return Deno.env.get(secretName)
  },
  createCorrelationId() {
    return crypto.randomUUID()
  },
  store(envelope) {
    return storeRawWebhookEvent(sql, envelope)
  },
}
