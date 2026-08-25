import { maxWorkId, uuidPattern } from "./patterns.ts"
import type { EntityReadInput } from "./types.ts"

export function parseEntityRead(input: unknown): EntityReadInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }
  const value = input as Record<string, unknown>
  if (
    Object.keys(value).length !== 3 ||
    typeof value.work_id !== "string" ||
    !/^[1-9][0-9]*$/.test(value.work_id) ||
    BigInt(value.work_id) > maxWorkId ||
    typeof value.entity_id !== "string" ||
    !uuidPattern.test(value.entity_id) ||
    typeof value.capability_token !== "string" ||
    !uuidPattern.test(value.capability_token)
  ) {
    return null
  }
  return { work_id: value.work_id, entity_id: value.entity_id,
    capability_token: value.capability_token }
}
