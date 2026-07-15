import { sql } from "./database.ts"
import type { DeliveryTrigger } from "./types.ts"

export async function reserveNextDelivery(): Promise<DeliveryTrigger | null> {
  const rows = await sql<DeliveryTrigger[]>`
    select reserved.event_id::text as event_id,
      reserved.message_id::text as message_id,
      reserved.capability_token::text as capability_token
    from warehouse_projection.reserve_internal_delivery() as reserved
  `
  return rows[0] ?? null
}
