import { DEV_PROJECT_REF } from "./constants.ts"
import { DEADMAN_ADVISORY_LOCK_KEY } from "./deadman_command_constants.ts"
import {
  REQUIRED_NODE_VERSION,
  REQUIRED_PNPM_VERSION,
  REQUIRED_RELEASE_BRANCH,
  REQUIRED_SUPABASE_VERSION,
} from "./repository_preflight_constants.ts"
import type { RecoveryControlInput } from "./recovery_control_types.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateRecoveryControlInput(value: unknown): RecoveryControlInput {
  const input = validateStrictRecord(value, [
    "projectRef", "repository", "guardJobId", "guardName", "guardSchedule",
    "targetJobs", "advisoryLockKey",
  ], "Recovery control input")
  validateNonnegativeInteger(input.guardJobId, "Recovery guard job ID")
  const repository = validateStrictRecord(input.repository, [
    "nodeVersion", "pnpmVersion", "supabaseCliVersion", "branch", "headSha", "projectRef",
  ], "Recovery repository evidence")
  if ((input.guardJobId as number) < 1 || input.projectRef !== DEV_PROJECT_REF ||
    input.guardName !== EXPECTED_GUARD_NAME ||
    input.guardSchedule !== EXPECTED_GUARD_SCHEDULE ||
    input.advisoryLockKey !== DEADMAN_ADVISORY_LOCK_KEY ||
    repository.nodeVersion !== REQUIRED_NODE_VERSION ||
    repository.pnpmVersion !== REQUIRED_PNPM_VERSION ||
    repository.supabaseCliVersion !== REQUIRED_SUPABASE_VERSION ||
    repository.branch !== REQUIRED_RELEASE_BRANCH ||
    repository.projectRef !== DEV_PROJECT_REF ||
    typeof repository.headSha !== "string" || !/^[a-f0-9]{40}$/.test(repository.headSha) ||
    !Array.isArray(input.targetJobs) ||
    JSON.stringify(input.targetJobs) !== JSON.stringify(EXPECTED_TARGET_JOBS)) {
    throw new Error("Recovery control evidence or identity is invalid")
  }
  return { ...input, repository } as unknown as RecoveryControlInput
}
