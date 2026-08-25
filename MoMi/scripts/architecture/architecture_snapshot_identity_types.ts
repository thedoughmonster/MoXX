export const architectureSnapshotIdentitySchemaId =
  "https://momi.local/schemas/architecture-snapshot-identity-v1.schema.json"

export type ArchitectureManifestSchemaIdentity = {
  id: string
  version: 1
}

export type ArchitectureSnapshotIdentity = {
  $schema: typeof architectureSnapshotIdentitySchemaId
  schema_version: 1
  repository: "thedoughmonster/momi-backend"
  branch: "dev"
  commit: string
  service_manifest_schema: ArchitectureManifestSchemaIdentity
  function_manifest_schema: ArchitectureManifestSchemaIdentity
  architecture_contract_version: 2
}

export type ArchitectureSnapshot = {
  identity: ArchitectureSnapshotIdentity
  digest: string
}

export type ArchitectureSnapshotDiagnostic = {
  code:
    | "authoritative_ref_missing"
    | "branch_mismatch"
    | "checkout_dirty"
    | "commit_invalid"
    | "commit_not_authoritative"
    | "digest_mismatch"
    | "identity_mismatch"
    | "repository_mismatch"
    | "schema_invalid"
    | "schema_mismatch"
    | "source_unavailable"
  field_path: string
  expected: unknown
  actual: unknown
}

export type ArchitectureSnapshotSource = {
  commit: string
  diagnostics: ArchitectureSnapshotDiagnostic[]
}

export class ArchitectureSnapshotSourceError extends Error {
  readonly diagnostics: ArchitectureSnapshotDiagnostic[]

  constructor(diagnostics: ArchitectureSnapshotDiagnostic[]) {
    super("architecture snapshot source is invalid")
    this.name = "ArchitectureSnapshotSourceError"
    this.diagnostics = diagnostics
  }
}
