import { claimOperation } from "./claim_operation.ts"
import { sql } from "./database.ts"
import { finishOperation } from "./finish_operation.ts"
import { sendRegisterWebhook } from "./send_register_webhook.ts"
import type { DeliveryDependencies } from "./types.ts"

export const deliveryDependencies: DeliveryDependencies = {
  getSetting: (name) => Deno.env.get(name),
  claim: (work) => claimOperation(sql, work),
  deliver: (operation, key, token, marker) => sendRegisterWebhook(operation, key, token, marker),
  finish: (operation, result, marker) => finishOperation(sql, operation, result, marker),
}
