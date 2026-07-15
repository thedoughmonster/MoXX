// service-owner: toast-order-ingest

import { sql } from "./database.ts"
import type { StoreDisposition, ToastWebhookPayload } from "./types.ts"

export async function storeRawOrderEvent(
  payload: ToastWebhookPayload,
  rawBody: string,
): Promise<StoreDisposition> {
  const eventCategory = payload.eventCategory
  const eventType = payload.eventType
  if (typeof eventCategory !== "string" || typeof eventType !== "string") {
    throw new Error("Unsupported Toast order webhook contract")
  }

  const details = payload.details
  const detailRecord =
    typeof details === "object" && details !== null && !Array.isArray(details)
      ? details as Record<string, unknown>
      : null
  const restaurantGuid =
    typeof detailRecord?.restaurantGuid === "string"
      ? detailRecord.restaurantGuid
      : null
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawBody),
  )
  const contentHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const correlationId = crypto.randomUUID()

  const legacyRows = await sql.begin(async (transaction) => {
    const rows = await transaction`
      insert into toast_raw.order_webhook_events (headers, payload)
      values (${transaction.json({})}, ${transaction.json(payload)})
      on conflict ((payload ->> 'guid')) do nothing
      returning id
    `
    if (rows.length === 0) {
      const existingLegacy = await transaction`
        select payload = ${transaction.json(payload)} as matches
        from toast_raw.order_webhook_events
        where payload ->> 'guid' = ${payload.guid}
      `
      if (existingLegacy[0]?.matches !== true) {
        throw new Error("Toast order event GUID payload conflict")
      }
    }
    const centralRows = await transaction`
      insert into toast_raw.webhook_events as archived (
        event_guid, subscription_key, event_category, event_type,
        restaurant_guid, correlation_id, source_occurred_at, headers, payload,
        raw_body, raw_body_exact, content_hash, handler_version
      ) values (
        ${payload.guid}, 'orders', ${eventCategory}, ${eventType},
        ${restaurantGuid}, ${correlationId}, ${payload.timestamp},
        ${transaction.json({})},
        ${transaction.json(payload)}, ${rawBody}, true, ${contentHash},
        'toast-orders-webhook-ingest-v1'
      )
      on conflict (event_guid) do update
      set raw_body = excluded.raw_body, raw_body_exact = true
      where archived.raw_body is null
        and archived.content_hash = excluded.content_hash
      returning content_hash
    `
    if (centralRows.length === 0) {
      const existingCentral = await transaction`
        select content_hash from toast_raw.webhook_events
        where event_guid = ${payload.guid}
      `
      if (existingCentral[0]?.content_hash !== contentHash) {
        throw new Error("Toast order event GUID content conflict")
      }
    }
    return rows
  })

  return legacyRows.length === 1 ? "stored" : "duplicate"
}
