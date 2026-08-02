import { DEV_PROJECT_REF } from "./constants.ts"
import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import type { GuardHeartbeatInput } from "./guard_heartbeat_types.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
} from "./sample_constants.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateGuardHeartbeatInput(value: unknown): GuardHeartbeatInput {
  const input = validateStrictRecord(value, [
    "projectRef", "runId", "guardJobId", "guardName", "guardSchedule",
    "targetJobs", "advisoryLockKey", "currentGenerationSha256",
    "nextGenerationSha256", "startCronRunId", "nextDeadmanCommand",
  ], "Guard heartbeat input")
  validateNonnegativeInteger(input.guardJobId, "Guard heartbeat job ID")
  validateNonnegativeInteger(input.startCronRunId, "Guard heartbeat baseline run ID")
  if ((input.guardJobId as number) < 1 || input.projectRef !== DEV_PROJECT_REF ||
    input.guardName !== EXPECTED_GUARD_NAME ||
    input.guardSchedule !== EXPECTED_GUARD_SCHEDULE ||
    input.advisoryLockKey !== DEADMAN_ADVISORY_LOCK_KEY ||
    typeof input.currentGenerationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.currentGenerationSha256) ||
    typeof input.nextGenerationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.nextGenerationSha256) ||
    input.currentGenerationSha256 === input.nextGenerationSha256 ||
    typeof input.nextDeadmanCommand !== "string") {
    throw new Error("Guard heartbeat identity or generation is invalid")
  }
  const expected = generateDeadmanCommand({
    runId: input.runId, generationSha256: input.nextGenerationSha256,
    startCronRunId: input.startCronRunId,
    guardName: input.guardName, guardSchedule: input.guardSchedule,
    targetJobs: input.targetJobs, advisoryLockKey: input.advisoryLockKey,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  if (input.nextDeadmanCommand !== expected) {
    throw new Error("Guard heartbeat next dead-man command is not canonical")
  }
  return input as unknown as GuardHeartbeatInput
}
