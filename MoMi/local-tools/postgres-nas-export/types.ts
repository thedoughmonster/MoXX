export type EnvironmentName = "dev" | "prod"
export type Operation = "export" | "verify" | "restore-drill"
export type ProcessOutput = "capture" | "inherit" | "silent"
export type ConnectionMode = "none" | "export" | "restore"

export type CliOptions = {
  operation: Operation
  environment: EnvironmentName
  projectRef: string
  target: string
  dryRun: boolean
  manualExportDir?: string
  resumeRunId?: string
  archiveId?: string
  isolatedTarget?: string
  quarter?: string
}

export type WorkspaceConfig = {
  schema_version: 1
  environments: Record<EnvironmentName, { project_ref: string }>
  database_schemas: string[]
}

export type PgTools = {
  pgDump: string
  pgRestore: string
}

export type RunPhase =
  | "dumped"
  | "validated"
  | "published"
  | "retained"
  | "verified"
  | "restored"
  | "recorded"

export type RunState = {
  schema_version: 1
  run_id: string
  operation: "export" | "restore-drill"
  environment: EnvironmentName
  project_ref: string
  archive_id: string
  schemas: string[]
  created_at: string
  updated_at: string
  status: "running" | "completed" | "failed"
  attempt_count: number
  completed_phases: RunPhase[]
  failure_phase?: string
  failure_at?: string
  manual_exports?: boolean
  manual_files?: ArchiveFile[]
  isolated_target?: string
  quarter?: string
}

export type ArchiveFile = {
  file: string
  bytes: number
  sha256: string
}

export type ScannedFile = ArchiveFile & {
  absolutePath: string
  modifiedMs: number
}

export type ScannedTree = {
  files: ScannedFile[]
  directories: string[]
}
export type PortableExport = ArchiveFile & {
  format: "plain-sql"
  compression: "gzip:9"
  schemas: string[]
}

export type DumpManifest = {
  schema_version: 2
  archive_id: string
  created_at: string
  environment: EnvironmentName
  project_ref: string
  postgres_major: 17
  format: "custom"
  compression: "gzip:9"
  schemas: string[]
  dump: {
    file: "database.pgdump"
    bytes: number
    sha256: string
  }
  portable_exports: {
    source: PortableExport & { file: "source.sql.gz" }
    warehouse: PortableExport & { file: "warehouse.sql.gz" }
  }
  manual_export_included: boolean
  manual_files: ArchiveFile[]
}

export type VerifiedArchive = {
  dumpPath: string
  sourcePath: string
  warehousePath: string
  manifest: DumpManifest
}
export type ArchiveSummary = {
  archiveId: string
  createdAt: string
  environment: EnvironmentName
  projectRef: string
}

export type LockHandle = {
  path: string
  token: string
}
