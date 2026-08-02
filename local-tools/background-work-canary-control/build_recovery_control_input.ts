import { DEADMAN_ADVISORY_LOCK_KEY } from "./deadman_command_constants.ts"
import type { RecoveryControlInput } from "./recovery_control_types.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export function buildRecoveryControlInput(
  runtime: ReleasedRuntime,
  guardJobId: number,
): RecoveryControlInput {
  return {
    projectRef: runtime.options.projectRef,
    repository: runtime.repository,
    guardJobId,
    guardName: EXPECTED_GUARD_NAME,
    guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS,
    advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
  }
}
