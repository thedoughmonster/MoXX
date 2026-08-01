import type { JsonRecord } from "./types.ts"

export function readWebhookIdentity(
  payload: JsonRecord,
  rawDigest: string,
): string {
  const eventId = payload.event_id
  return typeof eventId === "string" && eventId.length >= 1 && eventId.length <= 192
    ? `square:webhook:event:${eventId}`
    : `square:webhook:raw:sha256:${rawDigest}`
}
