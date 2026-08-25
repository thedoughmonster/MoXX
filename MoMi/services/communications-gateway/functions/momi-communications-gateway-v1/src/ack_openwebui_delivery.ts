import { getDatabase } from "./database.ts"

export async function ackOpenWebuiDelivery(value: {
  delivery_id: string; capability_token: string; disposition: "applied" | "duplicate"
}): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ acknowledged: boolean }[]>`
    select momi_communications_gateway.ack_openwebui_delivery_v1(
      ${value.delivery_id}::uuid, ${value.capability_token}::uuid,
      ${value.disposition}
    ) as acknowledged
  `
  return Boolean(rows[0]?.acknowledged)
}
