export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
export type JsonObject = { [key: string]: JsonValue }
export type CliOptions = {
  mode: "import" | "verify"
  backend: "supabase-cli" | "psql"
  environment: string
  projectRef: string
  source: string
  dryRun: boolean
}

export type SourceDescriptor = { database: string; table: string }

export type ManifestExport = {
  kind: "source_table" | "repair_findings"
  file: string
  format: "json_array_of_objects" | "json_object_with_findings_array"
  bytes: number
  sha256: string
  row_count: number
  rows_sha256: string
  source?: SourceDescriptor
  metadata?: JsonObject
}

export type PreservationManifest = {
  schema_version: 1
  package_id: string
  created_at: string
  dataset: "legacy_recipe"
  exports: ManifestExport[]
  metadata?: JsonObject
}

export type SourceRow = {
  ordinal: number
  source_key: string
  row_sha256: string
  payload_text: string
  row: JsonObject
}

export type RepairFinding = {
  ordinal: number
  finding_key: string
  category: string
  severity: string | null
  source_table?: string
  source_key?: string
  finding_sha256: string
  payload_text: string
  finding: JsonObject
}

export type FingerprintRow = { ordinal: number; key: string; sha256: string }

export type LoadedExport = {
  manifest: ManifestExport
  absolutePath: string
  sourceFileId: string
  sourceTableId?: string
  sourceRows?: SourceRow[]
  findings?: RepairFinding[]
}

export type LoadedPackage = {
  sourceRoot: string
  manifestPath: string
  manifestSha256: string
  ledgerSha256: string
  importRunId: string
  manifest: PreservationManifest
  rawManifest: JsonObject
  exports: LoadedExport[]
}

export type SqlPlanFile = {
  file: string
  phase: "import" | "verification-query" | "import-failure" | "verification-failure"
  bytes: number
  sha256: string
  batch_key?: string
  expected_row_count?: number
  payload_sha256?: string
}

export type PlannedSqlFile = SqlPlanFile & { sql: string }
export type SqlPlan = {
  schema_version: 1
  import_run_id: string
  source_package_id: string
  manifest_sha256: string
  generated_at: string
  files: SqlPlanFile[]
}
export type PlanOutput = {
  directory: string
  plan: SqlPlan
}

export type ChecksumLedger = ReadonlyMap<string, string>
export type AuthenticatedPackage = {
  sourceRoot: string
  portableRoot: string
  ledger: ChecksumLedger
  ledgerSha256: string
}
export type PackageTrust = {
  ledgerSha256: string
  manifestSha256: string
  databases: Readonly<Record<string, string>>
}
export type ExecutionBackend = {
  kind: "supabase-cli" | "psql"
  environment: NodeJS.ProcessEnv
  workspaceRoot: string
}
