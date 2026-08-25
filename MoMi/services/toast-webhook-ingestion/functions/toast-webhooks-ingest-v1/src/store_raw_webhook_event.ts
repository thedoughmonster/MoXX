// service-owner: toast-webhook-ingestion

import type {
  Database,
  StoreDisposition,
  WebhookEnvelope,
} from "./types.ts"

export async function storeRawWebhookEvent(
  database: Database,
  envelope: WebhookEnvelope,
): Promise<StoreDisposition> {
  const rows = await database`
    insert into toast_raw.webhook_events as archived (
      event_guid,
      subscription_key,
      event_category,
      event_type,
      restaurant_guid,
      correlation_id,
      source_occurred_at,
      headers,
      payload,
      raw_body,
      raw_body_exact,
      content_hash,
      handler_version
    ) values (
      ${envelope.eventGuid},
      ${envelope.subscriptionKey},
      ${envelope.eventCategory},
      ${envelope.eventType},
      ${envelope.restaurantGuid},
      ${envelope.correlationId},
      ${envelope.sourceOccurredAt},
      ${database.json({})},
      ${database.json(envelope.payload)},
      ${envelope.rawBody},
      true,
      ${envelope.contentHash},
      ${envelope.handlerVersion}
    )
    on conflict (event_guid) do update
    set raw_body = excluded.raw_body, raw_body_exact = true
    where archived.raw_body is null
      and archived.content_hash = excluded.content_hash
    returning id
  `
  if (rows.length === 1) return "stored"
  const existing = await database`
    select content_hash from toast_raw.webhook_events
    where event_guid = ${envelope.eventGuid}
  `
  if (existing[0]?.content_hash !== envelope.contentHash) {
    throw new Error("Toast webhook event GUID content conflict")
  }
  return "duplicate"
}
