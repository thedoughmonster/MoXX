import { DEADMAN_ADVISORY_LOCK_KEY, DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import type { GuardBootstrapInput } from "./guard_bootstrap_types.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export function buildGuardBootstrapInput(
  runtime: ReleasedRuntime,
  runId: string,
  generationSha256: string,
  startCronRunId: number,
): GuardBootstrapInput {
  const deadmanCommand = generateDeadmanCommand({
    runId, generationSha256, startCronRunId, guardName: EXPECTED_GUARD_NAME,
    guardSchedule: EXPECTED_GUARD_SCHEDULE, targetJobs: EXPECTED_TARGET_JOBS,
    advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  return {
    projectRef: runtime.options.projectRef, runId, generationSha256, startCronRunId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    deadmanCommand,
  }
}
