import { FAST_SAMPLE_KEYS } from "./sample_constants.ts"
import type { FastSample } from "./sample_types.ts"
import { validateGuardState } from "./validate_guard_state.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import { validateTargetJobs } from "./validate_target_jobs.ts"

export function validateFastSample(value: unknown): FastSample {
  const record = validateStrictRecord(value, FAST_SAMPLE_KEYS, "Fast sample")
  const targetJobs = validateTargetJobs(record.targetJobs)
  const guard = validateGuardState(record.guard)
  for (const key of FAST_SAMPLE_KEYS) {
    if (key !== "targetJobs" && key !== "guard") {
      validateNonnegativeInteger(record[key], `Fast sample ${key}`)
    }
  }
  return { ...record, targetJobs, guard } as unknown as FastSample
}
