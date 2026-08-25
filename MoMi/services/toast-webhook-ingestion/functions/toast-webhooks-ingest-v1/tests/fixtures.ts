// service-owner: toast-webhook-ingestion

import type { WebhookEnvelope } from "../src/types.ts"

export const timestamp = "2026-07-14T14:00:00.000Z"
export const eventGuid = "11111111-1111-4111-8111-111111111111"
export const restaurantGuid = "22222222-2222-4222-8222-222222222222"
export const correlationId = "33333333-3333-4333-8333-333333333333"
export const secret = "menus-test-secret"

export const menusBody = `{
  "timestamp": "${timestamp}",
  "eventCategory": "menus",
  "eventType": "menus_updated",
  "guid": "${eventGuid}",
  "details": {
    "restaurantGuid": "${restaurantGuid}",
    "publishedDate": "2026-07-14T13:59:00.000Z",
    "sourceField": { "preserved": true }
  }
}`

export const envelope: WebhookEnvelope = {
  eventGuid,
  subscriptionKey: "menus",
  eventCategory: "menus",
  eventType: "menus_updated",
  restaurantGuid,
  correlationId,
  sourceOccurredAt: timestamp,
  payload: JSON.parse(menusBody),
  rawBody: menusBody,
  contentHash: "a".repeat(64),
  handlerVersion: "toast-webhooks-ingest-v1",
}
