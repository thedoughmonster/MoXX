export const PROVIDER_STDERR_CODES = [
  "momi_guard_heartbeat_current_command",
  "momi_guard_heartbeat_expired",
  "momi_guard_heartbeat_guard_identity",
  "momi_guard_heartbeat_guard_inactive",
  "momi_guard_heartbeat_history_gap",
  "momi_guard_heartbeat_lock_unavailable",
  "momi_guard_heartbeat_materialization",
  "momi_guard_heartbeat_placeholder",
  "momi_guard_heartbeat_readback",
  "momi_guard_heartbeat_target_active",
  "momi_guard_heartbeat_target_identity",
  "momi_guard_heartbeat_target_running",
] as const

export type ProviderStderrCode = typeof PROVIDER_STDERR_CODES[number]
