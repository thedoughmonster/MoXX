import { sql } from "./database.ts"
import type { StoreDisposition, ToastStockWebhookPayload } from "./types.ts"

export async function storeRawStockEvent(
  headers: Record<string, string>,
  payload: ToastStockWebhookPayload,
): Promise<StoreDisposition> {
  const rows = await sql`
    insert into toast_raw.stock_webhook_events (headers, payload)
    values (${sql.json(headers)}, ${sql.json(payload)})
    on conflict ((payload ->> 'guid')) do nothing
    returning id
  `

  return rows.length === 1 ? "stored" : "duplicate"
}
