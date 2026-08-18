import { buildServiceDependencyEdges } from
  "./build_service_dependency_edges.ts"
import { buildServiceDependencyNodes } from
  "./build_service_dependency_nodes.ts"
import { digestServiceDependencyGraph } from
  "./digest_service_dependency_graph.ts"
import { findServiceDependencySourceDiagnostics } from
  "./find_service_dependency_source_diagnostics.ts"
import {
  ServiceDependencyGraphError,
  serviceDependencyGraphSchemaId,
  type ServiceDependencyGraph,
} from "./service_dependency_graph_types.ts"
import type { ArchitectureSnapshot } from
  "./architecture_snapshot_identity_types.ts"
import type { Architecture } from "./types.ts"

export function provideServiceDependencyGraph(
  architecture: Pick<Architecture, "services">,
  sourceSnapshot: ArchitectureSnapshot,
): ServiceDependencyGraph {
  const diagnostics = findServiceDependencySourceDiagnostics(
    architecture.services,
  )
  if (diagnostics.length > 0) throw new ServiceDependencyGraphError(diagnostics)
  const payload = {
    $schema: serviceDependencyGraphSchemaId,
    schema_version: 1 as const,
    source_snapshot: sourceSnapshot,
    nodes: buildServiceDependencyNodes(architecture.services),
    edges: buildServiceDependencyEdges(architecture.services),
  }
  return { ...payload, digest: digestServiceDependencyGraph(payload) }
}
