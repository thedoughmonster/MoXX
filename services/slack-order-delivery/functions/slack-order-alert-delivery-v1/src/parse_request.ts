import type { DeliveryTriggerInput } from "./types.ts"

const maxWorkId = 9223372036854775807n
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseDeliveryTrigger(
  input: unknown,
): DeliveryTriggerInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const record = input as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    !Object.hasOwn(record, "work_id") ||
    !Object.hasOwn(record, "trigger_token") ||
    typeof record.trigger_token !== "string" ||
    !uuidPattern.test(record.trigger_token)
  ) {
    return null
  }

  if (typeof record.work_id === "number") {
    return Number.isSafeInteger(record.work_id) && record.work_id > 0
      ? { work_id: String(record.work_id), trigger_token: record.trigger_token }
      : null
  }

  if (typeof record.work_id !== "string" || !/^[1-9][0-9]*$/.test(record.work_id)) {
    return null
  }

  return BigInt(record.work_id) <= maxWorkId
    ? { work_id: record.work_id, trigger_token: record.trigger_token }
    : null
}
