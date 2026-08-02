import type { DEV_PROJECT_REF } from "./constants.ts"
import type { DEADMAN_ADVISORY_LOCK_KEY } from "./deadman_command_constants.ts"
import type { RepositoryPreflight } from "./repository_preflight_types.ts"
import type {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import type { GuardState, TargetJobState } from "./sample_types.ts"

export type RecoveryControlInput = {
  projectRef: typeof DEV_PROJECT_REF
  repository: RepositoryPreflight
  guardJobId: number
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  targetJobs: typeof EXPECTED_TARGET_JOBS
  advisoryLockKey: typeof DEADMAN_ADVISORY_LOCK_KEY
}

export type RollbackResult = {
  targetJobs: readonly TargetJobState[]
  guardIdentityCount: number
  guardPresent: boolean
  guardJobId: number
  guard: GuardState
  guardState: "guard_absent" | "guard_inactive"
}

export type CleanupResult = {
  targetJobs: readonly TargetJobState[]
  guardIdentityCount: 0
  guardPresent: false
  guardJobId: 0
  guardState: "guard_absent"
}

export type RollbackModelInput = {
  childFresh: boolean
  lockAcquired: boolean
  targetIdentitiesMatch: boolean
  guardState: "absent" | "exact_active" | "exact_inactive" | "drift"
  targetReadbackInactive: boolean
  guardReadbackSafe: boolean
}

export type CleanupModelInput = {
  childFresh: boolean
  lockAcquired: boolean
  targetsInactive: boolean
  guardState: "absent" | "exact_active" | "exact_inactive" | "drift"
  unscheduleSucceeded: boolean
  guardAbsentReadback: boolean
}

export type RecoveryControlModelResult = {
  outcome: string
  actions: readonly string[]
}
