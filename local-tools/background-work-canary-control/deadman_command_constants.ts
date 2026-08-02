export const DEADMAN_ADVISORY_LOCK_KEY =
  "momi:#328:development-recovery-canary" as const
export const DEADMAN_EXPIRY_PLACEHOLDER =
  "__MOMI_DB_CLOCK_EXPIRY_UTC__" as const
export const DEADMAN_EXPIRY_SQL_EXPRESSION =
  "clock_timestamp() + interval '30 seconds'" as const
export const DEADMAN_COMMAND_TAG = "$$" as const
export const DEADMAN_GENERATION_PREFIX = "momi:deadman:generation" as const
export const DEADMAN_TERMINAL_MARKER = "momi:deadman:terminal:v1" as const
export const DEADMAN_TERMINAL_STATUS = "succeeded" as const
