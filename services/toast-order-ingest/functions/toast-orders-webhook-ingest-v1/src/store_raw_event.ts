import { sql } from "./database.ts"
import type { StoreDisposition, ToastWebhookPayload } from "./types.ts"

export async function storeRawEvent(
  headers: Record<string, string>,
  payload: ToastWebhookPayload,
): Promise<StoreDisposition> {
  const rows = await sql`
    insert into toast_raw.order_webhook_events (headers, payload)
    values (${sql.json(headers)}, ${sql.json(payload)})
    on conflict ((payload ->> 'guid')) do nothing
    returning id
  `

  return rows.length === 1 ? "stored" : "duplicate"
}
