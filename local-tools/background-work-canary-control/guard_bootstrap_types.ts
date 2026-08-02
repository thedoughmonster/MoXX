import type { DEV_PROJECT_REF } from "./constants.ts"
import type { DEADMAN_ADVISORY_LOCK_KEY } from "./deadman_command_constants.ts"
import type {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"

export type GuardBootstrapInput = {
  projectRef: typeof DEV_PROJECT_REF
  runId: string
  generationSha256: string
  startCronRunId: number
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  targetJobs: typeof EXPECTED_TARGET_JOBS
  advisoryLockKey: typeof DEADMAN_ADVISORY_LOCK_KEY
  deadmanCommand: string
}

export type GuardBootstrapResult = {
  guardJobId: number
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  guardActive: true
  runId: string
  generationSha256: string
  expiryUtc: string
  commandSha256: string
  commandMd5: string
}

export type GuardBootstrapModelInput = {
  lockAcquired: boolean
  targetIdentityMatches: boolean
  targetsInactive: boolean
  targetExecutions: number
  guardIdentityCount: number
  activeCronExecutions: number
  otherCronExecutions: number
  placeholderCount: number
  scheduledJobId: number
  readbackMatches: boolean
  readbackHashesMatch: boolean
}

export type GuardBootstrapModelOutcome =
  | "active_cron_limit"
  | "guard_present"
  | "lock_unavailable"
  | "other_cron_limit"
  | "placeholder_mismatch"
  | "readback_mismatch"
  | "schedule_failed"
  | "success"
  | "target_active"
  | "target_execution_present"
  | "target_identity_drift"

export type GuardBootstrapModelResult = {
  outcome: GuardBootstrapModelOutcome
  actions: readonly string[]
}
