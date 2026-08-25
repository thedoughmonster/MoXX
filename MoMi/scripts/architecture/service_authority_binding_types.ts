import type { ExecutionAuthority, ExecutionAuthorityContext } from
  "./execution_authority_types.ts"
import type { ServiceManifest } from "./types.ts"

export type ManifestAuthorityReference = {
  source_path: string
  json_pointer: string
  source_schema_version: "service-manifest/v1"
  value_digest: string
}

export type LegacyDebtReference = {
  source_path: string
  source_schema_id: string
  source_schema_version: "service-access-debt-baseline/v1"
  source_digest: string
  finding_fingerprints: string[]
}

export type ExecutionAuthorityReference = {
  work_item: string
  grant_id: string
  base_revision: string
  source_digest: string
  declaration_digest: string
}

export type ServiceAuthorityBinding = {
  $schema?: string
  schema_version: "service-authority-binding/v1"
  repository: string
  revision: string
  service: string
  binding_digest: string
  target_authority: ManifestAuthorityReference | null
  runtime_compatibility: ManifestAuthorityReference
  legacy_debt: LegacyDebtReference
  execution_authority: ExecutionAuthorityReference | null
}

export type ServiceAccessDebtFinding = {
  rule_id: string
  subject: string
  evidence: Record<string, string>
  fingerprint: string
}

export type IndexedManifestAuthoritySource = {
  source_path: string
  value: ServiceManifest
}

export type IndexedExecutionAuthoritySource = {
  source_path: string
  value: ExecutionAuthority
}

export type ServiceAuthorityBindingContext = {
  root: string
  repository: string
  revision: string
  manifests: Record<string, IndexedManifestAuthoritySource>
  debt: {
    source_path: string
    schema_id: string
    schema_version: number
    source_digest: string
    findings: ServiceAccessDebtFinding[]
  }
  executions: Record<string, IndexedExecutionAuthoritySource[]>
  execution_schema: object
  execution_context: ExecutionAuthorityContext
  execution_trust: ServiceAuthorityBindingTrustContext["execution"]
}

export type ServiceAuthorityBindingDiagnostic = {
  service: string
  layer: "binding" | "target" | "runtime" | "debt" | "execution"
  source_path: string
  json_pointer: string
  code: string
  target: string
  message: string
}

export type ServiceAuthorityBindingResolution = {
  binding?: ServiceAuthorityBinding
  diagnostics: ServiceAuthorityBindingDiagnostic[]
}

export type ServiceAuthorityBindingTrustContext = {
  revision: string
  execution: {
    grants: Record<string, {
      baseRevision: string
      sourceDigest: string
      externalAuthorities: Array<{
        authority_key: string
        operation: string
        resource: string
      }>
    }>
  }
}
