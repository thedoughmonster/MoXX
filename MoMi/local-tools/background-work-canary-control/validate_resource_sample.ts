import { RESOURCE_SAMPLE_KEYS } from "./sample_constants.ts"
import type { ResourceSample } from "./sample_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateResourceSample(value: unknown): ResourceSample {
  const record = validateStrictRecord(value, RESOURCE_SAMPLE_KEYS, "Resource sample")
  for (const key of RESOURCE_SAMPLE_KEYS) {
    validateNonnegativeInteger(record[key], `Resource sample ${key}`)
  }
  return record as unknown as ResourceSample
}
