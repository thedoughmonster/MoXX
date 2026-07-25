import { getDatabase } from "./database.ts"
import type { OpenWebuiDelivery } from "./openwebui_delivery.ts"

export async function claimOpenWebuiDelivery(): Promise<OpenWebuiDelivery | null> {
  const sql = getDatabase()
  const rows = await sql<OpenWebuiDelivery[]>`
    select delivery_id::text, capability_token::text, user_id::text,
      conversation_id, turn_id, content
    from momi_communications_gateway.claim_openwebui_delivery_v1()
  `
  return rows[0] ?? null
}
