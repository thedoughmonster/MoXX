export const ROLLBACK_MARKER = "momi.background-work-canary.rollback" as const
export const CLEANUP_MARKER = "momi.background-work-canary.cleanup" as const
export const ROLLBACK_DO_TAG = "$momi_guarded_rollback$" as const
export const CLEANUP_DO_TAG = "$momi_guard_cleanup$" as const

export const ROLLBACK_RESULT_KEYS = [
  "targetJobs", "guardIdentityCount", "guardPresent", "guardJobId", "guard",
  "guardState",
] as const
export const CLEANUP_RESULT_KEYS = [
  "targetJobs", "guardIdentityCount", "guardPresent", "guardJobId", "guardState",
] as const
