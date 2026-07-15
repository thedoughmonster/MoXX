import { sql } from "./database.ts"
import { subscriptionKey } from "./types.ts"

export async function acknowledgeDelivery(
  eventId: string,
  messageId: string,
  capabilityToken: string,
): Promise<boolean> {
  const rows = await sql<{ acknowledged: boolean }[]>`
    select momi_events.ack_delivery(
      ${subscriptionKey}, ${eventId}::uuid, ${messageId}::bigint,
      ${capabilityToken}::uuid
    ) as acknowledged
  `
  return rows[0]?.acknowledged === true
}
