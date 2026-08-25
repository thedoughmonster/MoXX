export type PathAuthority = {
  path: string
  kind: "file" | "directory"
  recursive: boolean
}

export type DatabaseAuthority = {
  owner_service: string
  object_kind: "table" | "view" | "routine" | "schema"
  qualified_object: string
}

export type ExternalAuthority = {
  authority_key: string
  operation: string
  resource: string
}

export type ExecutionAuthority = {
  $schema?: string
  schema_version: "execution-authority/v1"
  grant_id: string
  work_item: string
  service: string
  repository: string
  base_revision: string
  source_digest: string
  filesystem: { read: PathAuthority[]; write: PathAuthority[] }
  database: { read: DatabaseAuthority[]; write: DatabaseAuthority[] }
  contracts: { call: Array<{ provider_service: string; contract: string }> }
  network: { connect: Array<{ protocol: string; host: string; port: number }> }
  secrets: { reference: string[] }
  packages: { use: string[] }
  external: { invoke: ExternalAuthority[] }
  forbidden: {
    paths: string[]
    services: string[]
    database_objects: string[]
    contracts: string[]
    hosts: string[]
    secret_names: string[]
    external_actions: ExternalAuthority[]
    operation_classes: string[]
  }
  escalate_on: string[]
  provenance: {
    issue_authorization: { source: string; digest: string }
    accepted_decisions: Array<{ source: string; digest: string }>
    repository_rules: Array<{ source: string; digest: string }>
    manifests: Array<{ source: string; digest: string }>
    contracts: Array<{ source: string; digest: string }>
    external_authorities: Array<{ source: string; digest: string }>
    runtime_observations: Array<{ source: string; digest: string }>
    legacy_debt: Array<{ source: string; digest: string; targets: string[] }>
  }
}

export type LoadedExecutionAuthority = {
  label: string
  grant: ExecutionAuthority |
    import("./execution_authority_v2_types.ts").ExecutionAuthorityV2
}

export type ManifestAuthority = {
  database: { read: string[]; write: string[] }
  provides: string[]
  consumes: string[]
  network: string[]
  secrets: string[]
  packages: string[]
}

export type DatabaseOwnerIndex = {
  relations: Record<string, string[]>
  routines: Record<string, string[]>
  schemas: Record<string, string[]>
}

export type ExecutionAuthorityTrustContext = {
  grants: Record<string, {
    baseRevision: string
    sourceDigest: string
    externalAuthorities: ExternalAuthority[]
  }>
}

export type ExecutionAuthorityContext = {
  root: string
  repository: string
  baseRevision: string
  sourceDigest: string
  services: Record<string, ManifestAuthority>
  databaseOwners: DatabaseOwnerIndex
  externalAuthorities: ExternalAuthority[]
  debtTargets: string[]
}

export type ExecutionAuthorityDiagnostic = {
  grant_id: string
  field_path: string
  code: string
  target: string
  message: string
}
