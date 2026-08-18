import type { CheckCommand, CommandEvidence } from "./check_types.ts"
export type { AdvisoryMetadata, CheckCommand, CommandEvidence } from "./check_types.ts"

export type ImpactClass =
  | "architecture"
  | "docs"
  | "issue_automation"
  | "manifest"
  | "migration"
  | "repository_tooling"
  | "runtime"
  | "unknown"
  | "workflow"

export type ImpactPlan = {
  schema_version: 1
  classifications: Record<ImpactClass, string[]>
  affected_services: string[]
  affected_functions: string[]
  migrations: string[]
  iteration_checks: CheckCommand[]
  final_gate: {
    kind: "full" | "path_scoped"
    reason: string
    checks: CheckCommand[]
  }
  release: {
    database: "none" | "supabase_cli_preview_apply_parity"
    services: string[]
    functions: string[]
  }
}

export type BoundPlan = {
  schema_version: 1
  base: { ref: string; sha: string; tree: string }
  head: { ref: string; sha: string; tree: string }
  changed_paths: string[]
  diff_sha256: string
  impact_sha256: string
  impact: ImpactPlan
}

export type ReceiptInput = {
  kind: "validation" | "release" | "command"
  base_sha?: string
  head_sha?: string
  base_tree?: string
  head_tree?: string
  diff_sha256?: string
  impact_sha256?: string
  plan_sha256?: string
  run_id?: string
  log_url?: string
  commands: CommandEvidence[]
}

export type CompactReceipt = {
  schema_version: 2
  kind: ReceiptInput["kind"]
  identities: {
    base_sha?: string
    head_sha?: string
    base_tree?: string
    head_tree?: string
    diff_sha256?: string
    impact_sha256?: string
    plan_sha256?: string
  }
  counts: {
    commands: number
    hard_passed: number
    hard_failed: number
    advisory_passed: number
    advisory_findings: number
  }
  duration_ms: number
  run_log: { run_id?: string; log_url?: string }
  commands: Array<{
    id: string
    enforcement: "hard_stop" | "advisory"
    advisory?: {
      rule: "quality-report-freshness"
      path: "docs/quality-metrics.json"
      regenerate: "pnpm quality:generate"
    }
    status: number
    duration_ms: number
    stdout_path?: string
    stderr_path?: string
    failure_excerpt?: string
    advisory_excerpt?: string
  }>
}

export type ValidationReceipt = CompactReceipt & {
  kind: "validation"
  gate: "full" | "path_scoped"
  required_job: string
}

export type TriageConfig = {
  schema_version: 1
  labels_by_issue_type: {
    bug: string[]
    feature: string[]
  }
  context: {
    issue_body_characters: number
    comments: number
    comment_characters_each: number
    candidate_issues: number
    candidate_title_characters_each: number
    soft_estimated_tokens: number
    hard_estimated_tokens: number
  }
  queue: {
    pending_label: string
  }
}
