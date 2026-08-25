import type { DEV_PROJECT_REF } from "./constants.ts"
import type { DEADMAN_ADVISORY_LOCK_KEY } from "./deadman_command_constants.ts"
import type {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"

export type GuardHeartbeatInput = {
  projectRef: typeof DEV_PROJECT_REF
  runId: string
  guardJobId: number
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  targetJobs: typeof EXPECTED_TARGET_JOBS
  advisoryLockKey: typeof DEADMAN_ADVISORY_LOCK_KEY
  currentGenerationSha256: string
  nextGenerationSha256: string
  startCronRunId: number
  nextDeadmanCommand: string
}

export type GuardHeartbeatResult = {
  guardJobId: number
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  guardActive: true
  runId: string
  previousGenerationSha256: string
  nextGenerationSha256: string
  expiryUtc: string
  commandSha256: string
  commandMd5: string
}

export type GuardHeartbeatModelInput = {
  lockAcquired: boolean
  guardIdentityCount: number
  guardIdentityMatches: boolean
  guardActive: boolean
  currentCommandMatches: boolean
  currentExpiryValid: boolean
  targetIdentityMatches: boolean
  targetsInactive: boolean
  targetExecutions: number
  placeholderCount: number
  alterSucceeded: boolean
  readbackMatches: boolean
  readbackHashesMatch: boolean
}

export type GuardHeartbeatModelOutcome =
  | "alter_failed"
  | "current_command_mismatch"
  | "current_expired"
  | "guard_identity_error"
  | "guard_inactive"
  | "lock_unavailable"
  | "placeholder_mismatch"
  | "readback_mismatch"
  | "success"
  | "target_active"
  | "target_execution_present"
  | "target_identity_drift"

export type GuardHeartbeatModelResult = {
  outcome: GuardHeartbeatModelOutcome
  actions: readonly string[]
}
