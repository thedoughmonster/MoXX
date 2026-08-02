export const DEADMAN_RECONCILIATION_MARKER =
  "momi.background-work-canary.deadman-reconciliation" as const
export const DEADMAN_RECONCILIATION_RESULT_KEYS = [
  "observedAtUtcMs", "currentMaxRunId", "coveredAfterRunId",
  "guardIdentityCount", "guardJobId", "guardName", "guardSchedule",
  "guardActive", "runId", "generationSha256", "expiryUtc",
  "terminalCommandSha256", "terminalCommandMd5", "terminalGuardRunId",
  "terminalGuardStartUtc", "terminalExpectedStatus", "exactIdentityMask",
  "activeBeforeMask", "inactiveAfterMask", "originalCommandSha256",
  "originalCommandMd5", "maximumGuardRunId",
  "maximumGuardSuccessRunId", "maximumGuardFailureRunId",
  "successfulTerminalRunCount", "terminalFailureCount",
  "terminalHistoryStartUtc", "terminalHistoryStatus",
  "maximumAnyDeadmanRunId", "fast",
] as const
export const DEADMAN_RECONCILIATION_SQL_SHA256 =
  "d012173415e74cdaeb6de1682ec3c8290546b3b3deedc8d7374883c0db4634de" as const
