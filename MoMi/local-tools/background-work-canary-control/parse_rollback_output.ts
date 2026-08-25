import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import {
  ROLLBACK_MARKER,
  ROLLBACK_RESULT_KEYS,
} from "./recovery_control_constants.ts"
import type { RollbackResult } from "./recovery_control_types.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
} from "./sample_constants.ts"
import { validateGuardState } from "./validate_guard_state.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateRecoveryControlInput } from "./validate_recovery_control_input.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import { validateTargetJobs } from "./validate_target_jobs.ts"

export function parseRollbackOutput(
  output: Uint8Array,
  contextValue: unknown,
): RollbackResult {
  const context = validateRecoveryControlInput(contextValue)
  const row = validateStrictRecord(
    parseCliQueryEnvelope(output, ROLLBACK_MARKER),
    ROLLBACK_RESULT_KEYS,
    "Rollback result",
  )
  validateNonnegativeInteger(row.guardIdentityCount, "Rollback guard identity count")
  validateNonnegativeInteger(row.guardJobId, "Rollback guard job ID")
  const guardPresent = row.guardPresent === true
  if (typeof row.guardPresent !== "boolean" ||
    !["guard_absent", "guard_inactive"].includes(row.guardState as string) ||
    row.guardIdentityCount !== (guardPresent ? 1 : 0) ||
    row.guardJobId !== (guardPresent ? context.guardJobId : 0)) {
    throw new Error("Rollback guard evidence is invalid")
  }
  const targets = validateTargetJobs(row.targetJobs)
  const guard = validateGuardState(row.guard)
  if (targets.some((job) => job.active) || guard.active ||
    guard.jobName !== EXPECTED_GUARD_NAME || guard.schedule !== EXPECTED_GUARD_SCHEDULE ||
    row.guardState !== (guardPresent ? "guard_inactive" : "guard_absent")) {
    throw new Error("Rollback inactive readback is invalid")
  }
  return { ...row, targetJobs: targets, guard } as RollbackResult
}
