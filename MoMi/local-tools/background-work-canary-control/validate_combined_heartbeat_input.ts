import type { CombinedHeartbeatInput } from "./combined_heartbeat_types.ts"
import { validateGuardHeartbeatInput } from "./validate_guard_heartbeat_input.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateCombinedHeartbeatInput(value: unknown): CombinedHeartbeatInput {
  const input = validateStrictRecord(value, [
    "projectRef", "runId", "guardJobId", "guardName", "guardSchedule",
    "targetJobs", "advisoryLockKey", "currentGenerationSha256",
    "nextGenerationSha256", "startCronRunId", "nextDeadmanCommand", "includeResource",
  ], "Combined heartbeat input")
  if (typeof input.includeResource !== "boolean") {
    throw new Error("Combined heartbeat resource selection is invalid")
  }
  const { includeResource, ...heartbeatValue } = input
  const heartbeat = validateGuardHeartbeatInput(heartbeatValue)
  return { ...heartbeat, includeResource }
}
