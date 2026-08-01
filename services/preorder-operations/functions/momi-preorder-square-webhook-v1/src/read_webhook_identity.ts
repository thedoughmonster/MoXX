import type { JsonRecord } from "./types.ts"

export function readWebhookIdentity(
  payload: JsonRecord,
  rawDigest: string,
): string {
  const eventId = payload.event_id
  const eventType = payload.type
  return typeof eventId === "string" && eventId.length >= 1 && eventId.length <= 192 &&
      typeof eventType === "string" && eventType.length >= 1 && eventType.length <= 64
    ? `square:webhook:event:${eventType}:${eventId}`
    : `square:webhook:raw:sha256:${rawDigest}`
}
