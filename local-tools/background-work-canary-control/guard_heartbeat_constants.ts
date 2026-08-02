export const GUARD_HEARTBEAT_MARKER =
  "momi.background-work-canary.guard-heartbeat" as const
export const GUARD_HEARTBEAT_DO_TAG = "$momi_guard_heartbeat$" as const
export const CURRENT_DEADMAN_TEMPLATE_TAG = "$momi_current_deadman$" as const
export const NEXT_DEADMAN_TEMPLATE_TAG = "$momi_next_deadman$" as const

export const GUARD_HEARTBEAT_RESULT_KEYS = [
  "guardJobId", "guardName", "guardSchedule", "guardActive", "runId",
  "previousGenerationSha256", "nextGenerationSha256", "expiryUtc",
  "commandSha256", "commandMd5",
] as const
