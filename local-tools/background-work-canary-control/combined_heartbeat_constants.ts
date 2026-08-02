export const COMBINED_HEARTBEAT_MARKER =
  "momi.background-work-canary.guard-heartbeat-sample" as const

export const COMBINED_HEARTBEAT_RESULT_KEYS = [
  "heartbeat", "fast", "resourceIncluded", "resource",
] as const

export const COMBINED_HEARTBEAT_EVIDENCE_KEYS = [
  "guardJobId", "guardName", "guardSchedule", "guardActive", "runId",
  "previousGenerationSha256", "nextGenerationSha256", "expiryUtc",
  "commandSha256", "commandMd5", "observedAtUtcMs",
] as const
