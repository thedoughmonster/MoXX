import { acquireWebhookInventory } from "./acquire_webhook_inventory.ts"
import { claimJob } from "./claim_job.ts"
import { sql } from "./database.ts"
import { finishJob } from "./finish_job.ts"
import type { InventoryDependencies } from "./types.ts"

export const inventoryDependencies: InventoryDependencies = {
  getSetting: (name) => Deno.env.get(name),
  claim: (work) => claimJob(sql, work),
  acquire: (job, key, token) => acquireWebhookInventory(job, key, token),
  finish: (job, result) => finishJob(sql, job, result),
}
