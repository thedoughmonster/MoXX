import type {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import type {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"

export type DeadmanCommandInput = {
  runId: string
  generationSha256: string
  startCronRunId: number
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  targetJobs: typeof EXPECTED_TARGET_JOBS
  advisoryLockKey: typeof DEADMAN_ADVISORY_LOCK_KEY
  expiryPlaceholder: typeof DEADMAN_EXPIRY_PLACEHOLDER
}

export type DeadmanModelInput = {
  invocationGeneration: string
  currentGeneration: string
  nowUtcMs: number
  expiryUtcMs: number
  guardIdentityCount: number
  exactIdentityMask: number
  activeBeforeMask: number
  inactiveAfterMask: number
}

export type DeadmanModelOutcome =
  | "before_expiry"
  | "deactivated"
  | "deactivated_manual_evidence"
  | "guard_identity_error"
  | "stale_generation"

export type DeadmanModelResult = {
  outcome: DeadmanModelOutcome
  actions: readonly string[]
}
