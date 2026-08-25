export const GUARD_BOOTSTRAP_MARKER =
  "momi.background-work-canary.guard-bootstrap" as const
export const GUARD_BOOTSTRAP_DO_TAG = "$momi_guard_bootstrap$" as const
export const DEADMAN_TEMPLATE_TAG = "$momi_deadman_template$" as const
export const GUARD_BOOTSTRAP_STATEMENT_TIMEOUT = "10s" as const
export const GUARD_BOOTSTRAP_LOCK_TIMEOUT = "1s" as const

export const GUARD_BOOTSTRAP_RESULT_KEYS = [
  "guardJobId", "guardName", "guardSchedule", "guardActive", "runId",
  "generationSha256", "expiryUtc", "commandSha256", "commandMd5",
] as const
