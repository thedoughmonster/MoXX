import { sql } from "./database.ts"

export async function beginDelivery(
  eventId: string,
  messageId: string,
  capabilityToken: string,
): Promise<boolean> {
  const rows = await sql<{ begun: boolean }[]>`
    select warehouse_projection.begin_reserved_delivery(
      ${eventId}::uuid, ${messageId}::bigint,
      ${capabilityToken}::uuid
    ) as begun
  `
  return rows[0]?.begun === true
}
