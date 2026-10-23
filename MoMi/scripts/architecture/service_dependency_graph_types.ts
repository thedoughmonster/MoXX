import type { ArchitectureSnapshot } from
  "./architecture_snapshot_identity_types.ts"

export const serviceDependencyGraphSchemaId =
  "https://momi.local/schemas/service-dependency-graph-v2.schema.json"

export type ServiceDependencyNode = {
  service_key: string
  manifest_path: string
}

export type ServiceDependencyEdge = {
  provider: string
  consumer: string
  contract: string
  provider_manifest_path: string
  consumer_manifest_path: string
}

export type ServiceDependencyGraphPayload = {
  $schema: typeof serviceDependencyGraphSchemaId
  schema_version: 2
  source_snapshot: ArchitectureSnapshot
  nodes: ServiceDependencyNode[]
  edges: ServiceDependencyEdge[]
}

export type ServiceDependencyGraph = ServiceDependencyGraphPayload & {
  digest: string
}

export type ServiceDependencyGraphDiagnostic = {
  code:
    | "cycle_detected"
    | "digest_mismatch"
    | "duplicate_edge"
    | "duplicate_node"
    | "duplicate_provided_contract"
    | "graph_mismatch"
    | "manifest_path_mismatch"
    | "missing_provider_contract"
    | "schema_invalid"
    | "schema_mismatch"
    | "self_dependency"
    | "stale_snapshot"
    | "unknown_node"
    | "unknown_provider"
    | "unsorted_edges"
    | "unsorted_nodes"
    | "version_mismatch"
  field_path: string
  expected: unknown
  actual: unknown
}

export class ServiceDependencyGraphError extends Error {
  readonly diagnostics: ServiceDependencyGraphDiagnostic[]

  constructor(diagnostics: ServiceDependencyGraphDiagnostic[]) {
    super("service dependency graph is invalid")
    this.name = "ServiceDependencyGraphError"
    this.diagnostics = diagnostics
  }
}
