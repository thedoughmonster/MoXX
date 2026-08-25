export type CheckEnforcement = "hard_stop" | "advisory"

export type AdvisoryMetadata =
  | {
    rule: "quality-report-freshness"
    path: "docs/quality-metrics.json"
    regenerate: "pnpm quality:generate"
  }
  | {
    rule: "source-quality-soft-limit"
    path: "."
    remediate: "Refactor reported handwritten files to 120 lines or fewer"
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
  stdout_sha256?: string
  stderr_sha256?: string
  stdout?: string
  stderr?: string
}
