import type { ServiceManifest } from "./types.ts"

export type DatabaseObjectIdentity =
  | { class: "relation"; schema: string; name: string }
  | { class: "routine"; schema: string; name: string; arguments: string[] }
  | { class: "sequence"; schema: string; name: string }

export type DatabaseCapabilityMode =
  | "relation.read" | "relation.write" | "routine.call" | "sequence.use"

export type DatabaseObjectAuthorityDiagnostic = {
  subject: string
  layer: string
  source_path: string
  json_pointer: string
  code: string
  object_class: string
  canonical_identity: string
  mode: string
}

export type AuthoritySourceDescriptor = {
  classification: "accepted_decision" | "legacy_debt" | "migration" |
    "service_manifest"
  path: string
  blob_id: string
  schema_version: string
}

export type DatabaseAuthorityObject = {
  identity: DatabaseObjectIdentity
  owner_service: string
  relation_kind?: "table" | "view" | "materialized view"
  source_path: string
  json_pointer: string
  replay_identity: string
}

export type RuntimeCompatibility = {
  service: string
  source_mode: "database.read" | "database.write"
  source_path: string
  json_pointer: string
  scope: { kind: "historical_broad_migration_debt"; schema: string } |
    { kind: "exact_object"; object: DatabaseObjectIdentity }
}

export type PublicDatabaseMapping = {
  provider_service: string
  contract: string
  mapping_kind: "public_relation_reads" | "public_routine_reads" |
    "public_routine_commands" | "dynamic_read_routines"
  object: DatabaseObjectIdentity
  capability: "relation.read" | "routine.call"
  source_path: string
  json_pointer: string
  consumer_service?: string
  role?: string
  allowed_schema?: string
}

export type DatabaseObjectAuthority = {
  $schema?: string
  schema_version: "database-object-authority/v1"
  repository: string
  revision: string
  source_digest: string
  authority_digest: string
  objects: DatabaseAuthorityObject[]
  runtime_compatibility: RuntimeCompatibility[]
  migration_ownership: Array<{
    path: string; blob_id: string; owner_service: string; mode: "migration.own"
  }>
  public_mappings: PublicDatabaseMapping[]
  legacy_debt_reference: { path: string; schema_version: string; digest: string }
}

export type DatabaseObjectAuthorityRevision = {
  repository: string
  revision: string
  manifests: Array<{ path: string; blob_id: string; value: ServiceManifest }>
  migrations: Array<{ path: string; blob_id: string; source: string }>
  external_relations: Array<{ path: string; blob_id: string; identity: string }>
  legacy_debt: { path: string; blob_id: string; source: string; schema_version: string }
  source_descriptors: AuthoritySourceDescriptor[]
}

export type DatabaseObjectCatalog = {
  relations: Map<string, "table" | "view" | "materialized view">
  routines: Map<string, Array<Extract<DatabaseObjectIdentity, { class: "routine" }>>>
}

export type DatabaseObjectAuthorityResult = {
  authority: DatabaseObjectAuthority
  diagnostics: DatabaseObjectAuthorityDiagnostic[]
}
