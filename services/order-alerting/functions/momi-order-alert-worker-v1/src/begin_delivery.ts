import { sql } from "./database.ts"
import { subscriptionKey } from "./delivery_types.ts"

export async function beginDelivery(
  eventId: string,
  messageId: string,
  capabilityToken: string,
): Promise<boolean> {
  const rows = await sql<{ begun: boolean }[]>`
    select momi_events.begin_delivery(
      ${subscriptionKey}, ${eventId}::uuid, ${messageId}::bigint,
      ${capabilityToken}::uuid
    ) as begun
  `
  return rows[0]?.begun === true
}
