import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import {
  CLEANUP_MARKER,
  CLEANUP_RESULT_KEYS,
} from "./recovery_control_constants.ts"
import type { CleanupResult } from "./recovery_control_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateRecoveryControlInput } from "./validate_recovery_control_input.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import { validateTargetJobs } from "./validate_target_jobs.ts"

export function parseCleanupOutput(
  output: Uint8Array,
  contextValue: unknown,
): CleanupResult {
  validateRecoveryControlInput(contextValue)
  const row = validateStrictRecord(
    parseCliQueryEnvelope(output, CLEANUP_MARKER),
    CLEANUP_RESULT_KEYS,
    "Cleanup result",
  )
  validateNonnegativeInteger(row.guardIdentityCount, "Cleanup guard identity count")
  validateNonnegativeInteger(row.guardJobId, "Cleanup guard job ID")
  const targets = validateTargetJobs(row.targetJobs)
  if (targets.some((job) => job.active) || row.guardIdentityCount !== 0 ||
    row.guardPresent !== false || row.guardJobId !== 0 ||
    row.guardState !== "guard_absent") {
    throw new Error("Cleanup absence readback is invalid")
  }
  return { ...row, targetJobs: targets } as CleanupResult
}
