import type { OrderReadInput } from "./types.ts"

const maxWorkId = 9223372036854775807n
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseOrderReadRequest(input: unknown): OrderReadInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const record = input as Record<string, unknown>
  const orderId = record.order_id
  const triggerToken = record.trigger_token
  if (
    Object.keys(record).length !== 3 || !("work_id" in record) ||
    typeof orderId !== "string" || orderId.trim().length === 0 ||
    typeof triggerToken !== "string" || !uuidPattern.test(triggerToken)
  ) {
    return null
  }

  const workId = record.work_id
  if (typeof workId === "number") {
    return Number.isSafeInteger(workId) && workId > 0
      ? { work_id: String(workId), order_id: orderId, trigger_token: triggerToken }
      : null
  }

  if (typeof workId !== "string" || !/^[1-9][0-9]*$/.test(workId)) {
    return null
  }

  return BigInt(workId) <= maxWorkId
    ? { work_id: workId, order_id: orderId, trigger_token: triggerToken }
    : null
}
