import type { CombinedHeartbeatInput } from "./combined_heartbeat_types.ts"
import { DEADMAN_ADVISORY_LOCK_KEY, DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export function buildCombinedHeartbeatInput(
  runtime: ReleasedRuntime,
  runId: string,
  guardJobId: number,
  currentGenerationSha256: string,
  nextGenerationSha256: string,
  startCronRunId: number,
  includeResource: boolean,
): CombinedHeartbeatInput {
  const nextDeadmanCommand = generateDeadmanCommand({
    runId, generationSha256: nextGenerationSha256, startCronRunId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  return {
    projectRef: runtime.options.projectRef, runId, guardJobId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    currentGenerationSha256, nextGenerationSha256, startCronRunId, nextDeadmanCommand,
    includeResource,
  }
}
