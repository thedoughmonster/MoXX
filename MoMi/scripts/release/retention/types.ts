export type RetentionEnvironment = "dev" | "prod"

export type RetentionApprovalContext = {
  environment: RetentionEnvironment
  source_sha: string
  approval_sha256: string
  now: number
}

export type RetentionApproval = {
  schema_version: 1
  kind: "retention-release-exception"
  environment: RetentionEnvironment
  project_ref: string
  source_sha: string
  issued_at: string
  expires_at: string
  metrics_runtime_selection: {
    environment: RetentionEnvironment
    project_ref: string
    source: "SUPABASE_SECRET_KEYS"
    key: "default"
    owner: "Zac"
    method: "owner_runtime_source_selection"
    selected_at: string
  }
  validation: { run_id: number; head_sha: string; receipt_sha256: string }
  before: {
    ledger_sha256: string
    objects_sha256: string
    functions_sha256: string
    versions: string[]
  }
  function_source_sha256: string
  migrations: string[]
  deferred_versions: string[]
  dev_receipt: null | { run_id: number; artifact_id: number; run_attempt: number; sha256: string }
}
