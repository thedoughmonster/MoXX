import { sql } from "./database.ts"

export async function projectAndAcknowledgeDelivery(
  eventId: string,
  messageId: string,
  capabilityToken: string,
): Promise<unknown> {
  const rows = await sql<{ outcome: unknown }[]>`
    select warehouse_projection.project_and_ack_delivery(
      ${eventId}::uuid, ${messageId}::bigint, ${capabilityToken}::uuid
    ) as outcome
  `
  return rows[0]?.outcome
}
