export type CheckEnforcement = "hard_stop" | "advisory"

export type AdvisoryMetadata = {
  rule: "quality-report-freshness"
  path: "docs/quality-metrics.json"
  regenerate: "pnpm quality:generate"
}

export type CheckCommand = {
  id: string
  command: string
  args: string[]
  enforcement: CheckEnforcement
  advisory?: AdvisoryMetadata
}

export type CommandEvidence = {
  id: string
  enforcement: CheckEnforcement
  advisory?: AdvisoryMetadata
  status: number
  duration_ms: number
  stdout_path?: string
  stderr_path?: string
  stdout?: string
  stderr?: string
}
