import type { OrderReadInput } from "./types.ts"

const maxWorkId = 9223372036854775807n
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseOrderRead(input: unknown): OrderReadInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }
  const value = input as Record<string, unknown>
  if (
    Object.keys(value).length !== 3 ||
    typeof value.work_id !== "string" || !/^[1-9][0-9]*$/.test(value.work_id) ||
    BigInt(value.work_id) > maxWorkId ||
    typeof value.order_id !== "string" || !uuidPattern.test(value.order_id) ||
    typeof value.capability_token !== "string" ||
    !uuidPattern.test(value.capability_token)
  ) {
    return null
  }
  return { work_id: value.work_id, order_id: value.order_id,
    capability_token: value.capability_token }
}
