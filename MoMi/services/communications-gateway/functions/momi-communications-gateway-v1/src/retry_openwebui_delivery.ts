import { getDatabase } from "./database.ts"

export async function retryOpenWebuiDelivery(value: {
  delivery_id: string; capability_token: string; error_code: string
}): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ retried: boolean }[]>`
    select momi_communications_gateway.retry_openwebui_delivery_v1(
      ${value.delivery_id}::uuid, ${value.capability_token}::uuid,
      ${value.error_code}
    ) as retried
  `
  return Boolean(rows[0]?.retried)
}
