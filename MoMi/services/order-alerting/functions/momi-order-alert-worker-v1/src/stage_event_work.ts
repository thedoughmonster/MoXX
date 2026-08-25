import { sql } from "./database.ts"
import type { DeliveryTrigger, StagedEventWork } from "./delivery_types.ts"

export async function stageEventWork(
  trigger: DeliveryTrigger,
): Promise<StagedEventWork | null> {
  const rows = await sql<StagedEventWork[]>`
    select * from momi_alerting.stage_order_event_work(
      ${trigger.event_id}::uuid, ${trigger.message_id}::bigint,
      ${trigger.capability_token}::uuid
    )
  `
  return rows[0] ?? null
}
