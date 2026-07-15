import type { DeliveryTrigger } from "./delivery_types.ts"

const maxMessageId = 9223372036854775807n
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseDeliveryTrigger(input: unknown): DeliveryTrigger | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }
  const record = input as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== 3 || keys.some((key) =>
    key !== "event_id" && key !== "message_id" &&
    key !== "capability_token")) return null
  if (typeof record.event_id !== "string" ||
      !uuidPattern.test(record.event_id)) return null
  if (typeof record.message_id !== "string" ||
      !/^[1-9][0-9]*$/.test(record.message_id) ||
      BigInt(record.message_id) > maxMessageId) return null
  if (typeof record.capability_token !== "string" ||
      !uuidPattern.test(record.capability_token)) return null
  return record as DeliveryTrigger
}
