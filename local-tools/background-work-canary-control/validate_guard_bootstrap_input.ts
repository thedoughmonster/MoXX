import { DEV_PROJECT_REF } from "./constants.ts"
import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import type { GuardBootstrapInput } from "./guard_bootstrap_types.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
} from "./sample_constants.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateGuardBootstrapInput(value: unknown): GuardBootstrapInput {
  const input = validateStrictRecord(value, [
    "projectRef", "runId", "generationSha256", "startCronRunId", "guardName", "guardSchedule",
    "targetJobs", "advisoryLockKey", "deadmanCommand",
  ], "Guard bootstrap input")
  if (input.projectRef !== DEV_PROJECT_REF ||
    input.guardName !== EXPECTED_GUARD_NAME ||
    input.guardSchedule !== EXPECTED_GUARD_SCHEDULE ||
    input.advisoryLockKey !== DEADMAN_ADVISORY_LOCK_KEY ||
    typeof input.deadmanCommand !== "string") {
    throw new Error("Guard bootstrap identity input is invalid")
  }
  const expected = generateDeadmanCommand({
    runId: input.runId,
    generationSha256: input.generationSha256,
    startCronRunId: input.startCronRunId,
    guardName: input.guardName,
    guardSchedule: input.guardSchedule,
    targetJobs: input.targetJobs,
    advisoryLockKey: input.advisoryLockKey,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  if (input.deadmanCommand !== expected) {
    throw new Error("Guard bootstrap dead-man command is not canonical")
  }
  return input as unknown as GuardBootstrapInput
}
