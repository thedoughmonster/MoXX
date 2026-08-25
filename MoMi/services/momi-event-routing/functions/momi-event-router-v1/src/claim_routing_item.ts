import { sql } from "./database.ts"

export async function claimRoutingItem(
  eventId: string,
  capabilityToken: string,
): Promise<boolean> {
  const claimed = await sql<{ claimed: boolean }[]>`
    select momi_events.claim_routing_work_item(
      ${eventId}::uuid,
      ${capabilityToken}::uuid
    ) as claimed
  `
  return claimed[0]?.claimed ?? false
}
