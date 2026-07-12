import { sql } from "./database.ts"
import type { StoreResult, ToastWebhookPayload } from "./types.ts"

export async function storeRawEvent(
  headers: Record<string, string>,
  payload: ToastWebhookPayload,
): Promise<StoreResult> {
  const inserted = await sql`
    insert into toast_raw.order_webhook_events (headers, payload)
    values (${sql.json(headers)}, ${sql.json(payload)})
    on conflict ((payload ->> 'guid')) do nothing
    returning id::text as raw_event_id
  `

  if (inserted.length === 1) {
    return { disposition: "stored", rawEventId: inserted[0].raw_event_id }
  }

  const existing = await sql`
    select id::text as raw_event_id
    from toast_raw.order_webhook_events
    where payload ->> 'guid' = ${payload.guid}
  `

  if (existing.length !== 1) {
    throw new Error("stored Toast event could not be resolved")
  }

  return { disposition: "duplicate", rawEventId: existing[0].raw_event_id }
}
