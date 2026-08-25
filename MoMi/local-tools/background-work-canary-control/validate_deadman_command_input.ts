import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import type { DeadmanCommandInput } from "./deadman_command_types.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import { validateRunId } from "./validate_run_id.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateDeadmanCommandInput(value: unknown): DeadmanCommandInput {
  const input = validateStrictRecord(value, [
    "runId", "generationSha256", "startCronRunId", "guardName", "guardSchedule", "targetJobs",
    "advisoryLockKey", "expiryPlaceholder",
  ], "Dead-man command input")
  if (typeof input.runId !== "string") throw new Error("Dead-man run ID is invalid")
  validateRunId(input.runId)
  if (!Number.isSafeInteger(input.startCronRunId) || (input.startCronRunId as number) < 0) {
    throw new Error("Dead-man run-history baseline is invalid")
  }
  if (typeof input.generationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.generationSha256) ||
    input.guardName !== EXPECTED_GUARD_NAME ||
    input.guardSchedule !== EXPECTED_GUARD_SCHEDULE ||
    input.advisoryLockKey !== DEADMAN_ADVISORY_LOCK_KEY ||
    input.expiryPlaceholder !== DEADMAN_EXPIRY_PLACEHOLDER ||
    !Array.isArray(input.targetJobs) ||
    input.targetJobs.length !== EXPECTED_TARGET_JOBS.length) {
    throw new Error("Dead-man command identity input is invalid")
  }
  for (const [index, expected] of EXPECTED_TARGET_JOBS.entries()) {
    const target = validateStrictRecord(input.targetJobs[index], [
      "jobId", "jobName", "schedule", "commandMd5",
    ], "Dead-man target")
    if (target.jobId !== expected.jobId || target.jobName !== expected.jobName ||
      target.schedule !== expected.schedule || target.commandMd5 !== expected.commandMd5) {
      throw new Error("Dead-man target identity input is invalid")
    }
  }
  return input as unknown as DeadmanCommandInput
}
