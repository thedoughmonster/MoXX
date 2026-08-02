export type DeadmanTerminalCommandInput = {
  runId: string
  generationSha256: string
  expiryUtc: string
  guardRunId: number
  guardStartUtc: string
  exactIdentityMask: number
  activeBeforeMask: number
  inactiveAfterMask: number
  originalCommandSha256: string
  originalCommandMd5: string
}

export type DeadmanTerminalEvidence = DeadmanTerminalCommandInput & {
  guardStatus: "succeeded"
  terminalCommandSha256: string
  terminalCommandMd5: string
  successfulTerminalRunCount: number
  terminalFailureCount: number
}
