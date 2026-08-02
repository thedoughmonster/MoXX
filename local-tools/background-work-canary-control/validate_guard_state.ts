import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE } from "./sample_constants.ts"
import type { GuardState } from "./sample_types.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateGuardState(value: unknown): GuardState {
  const record = validateStrictRecord(
    value,
    ["jobName", "schedule", "active"],
    "Guard",
  )
  if (record.jobName !== EXPECTED_GUARD_NAME ||
    record.schedule !== EXPECTED_GUARD_SCHEDULE ||
    typeof record.active !== "boolean") {
    throw new Error("Guard identity or schedule drifted")
  }
  return {
    jobName: EXPECTED_GUARD_NAME,
    schedule: EXPECTED_GUARD_SCHEDULE,
    active: record.active,
  }
}
