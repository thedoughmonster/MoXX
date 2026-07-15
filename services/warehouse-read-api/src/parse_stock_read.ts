import { maxWorkId, uuidPattern } from "./patterns.ts"
import type { StockReadInput } from "./types.ts"

export function parseStockRead(input: unknown): StockReadInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }
  const value = input as Record<string, unknown>
  if (
    Object.keys(value).length !== 4 ||
    typeof value.work_id !== "string" ||
    !/^[1-9][0-9]*$/.test(value.work_id) ||
    BigInt(value.work_id) > maxWorkId ||
    typeof value.item_id !== "string" || !uuidPattern.test(value.item_id) ||
    typeof value.location_id !== "string" ||
    !uuidPattern.test(value.location_id) ||
    typeof value.capability_token !== "string" ||
    !uuidPattern.test(value.capability_token)
  ) {
    return null
  }
  return { work_id: value.work_id, item_id: value.item_id,
    location_id: value.location_id,
    capability_token: value.capability_token }
}
