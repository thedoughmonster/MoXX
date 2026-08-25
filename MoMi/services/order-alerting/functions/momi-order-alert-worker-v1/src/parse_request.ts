import type { WorkTriggerInput } from "./types.ts"

const maxWorkId = 9223372036854775807n
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseWorkTrigger(input: unknown): WorkTriggerInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }
  const record = input as Record<string, unknown>
  const token = record.trigger_token
  if (
    Object.keys(record).length !== 2 || !("work_id" in record) ||
    typeof token !== "string" || !uuidPattern.test(token)
  ) {
    return null
  }
  const workId = record.work_id
  if (typeof workId === "number") {
    return Number.isSafeInteger(workId) && workId > 0
      ? { work_id: String(workId), trigger_token: token }
      : null
  }
  if (typeof workId !== "string" || !/^[1-9][0-9]*$/.test(workId)) {
    return null
  }
  return BigInt(workId) <= maxWorkId
    ? { work_id: workId, trigger_token: token }
    : null
}
