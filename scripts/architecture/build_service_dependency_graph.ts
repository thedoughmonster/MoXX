import { buildArchitectureSnapshotIdentity } from
  "./build_architecture_snapshot_identity.ts"
import { provideServiceDependencyGraph } from
  "./provide_service_dependency_graph.ts"
import { readJson } from "./read_json.ts"
import { serviceDependencyGraphSchemaPath } from "./paths.ts"
import { validateArchitecture } from "./validate_architecture.ts"
import { validateJson } from "./validate_json.ts"
import type { ServiceDependencyGraph } from
  "./service_dependency_graph_types.ts"

export async function buildServiceDependencyGraph(): Promise<
  ServiceDependencyGraph
> {
  const sourceSnapshot = await buildArchitectureSnapshotIdentity()
  const architecture = await validateArchitecture()
  const graph = provideServiceDependencyGraph(architecture, sourceSnapshot)
  const schema = await readJson<object>(serviceDependencyGraphSchemaPath)
  validateJson(schema, graph, "service dependency graph")
  return graph
}
