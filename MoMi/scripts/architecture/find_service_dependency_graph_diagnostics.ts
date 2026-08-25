import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { digestServiceDependencyGraph } from
  "./digest_service_dependency_graph.ts"
import { findServiceDependencyEdgeDiagnostics } from
  "./find_service_dependency_edge_diagnostics.ts"
import { findServiceDependencyNodeDiagnostics } from
  "./find_service_dependency_node_diagnostics.ts"
import { sortServiceDependencyDiagnostics } from
  "./sort_service_dependency_diagnostics.ts"
import {
  serviceDependencyGraphSchemaId,
  type ServiceDependencyGraph,
  type ServiceDependencyGraphDiagnostic,
} from "./service_dependency_graph_types.ts"

export function findServiceDependencyGraphDiagnostics(
  expected: unknown,
  actual?: ServiceDependencyGraph,
): ServiceDependencyGraphDiagnostic[] {
  const record = expected && typeof expected === "object" &&
      !Array.isArray(expected)
    ? expected as Record<string, unknown> : {}
  const diagnostics = [
    ...findServiceDependencyNodeDiagnostics(record),
    ...findServiceDependencyEdgeDiagnostics(record),
  ]
  if (record.$schema !== serviceDependencyGraphSchemaId) diagnostics.push({
    code: "schema_mismatch", field_path: "/$schema",
    expected: serviceDependencyGraphSchemaId, actual: record.$schema,
  })
  if (record.schema_version !== 1) diagnostics.push({
    code: "version_mismatch", field_path: "/schema_version",
    expected: 1, actual: record.schema_version,
  })
  const expectedDigest = digestServiceDependencyGraph(
    record as unknown as ServiceDependencyGraph,
  )
  if (record.digest !== expectedDigest) diagnostics.push({
    code: "digest_mismatch", field_path: "/digest",
    expected: expectedDigest, actual: record.digest,
  })
  if (actual) {
    for (const field of ["source_snapshot", "nodes", "edges"] as const) {
      if (canonicalJson(record[field]) !== canonicalJson(actual[field])) {
        diagnostics.push({
          code: "graph_mismatch", field_path: `/${field}`,
          expected: record[field], actual: actual[field],
        })
      }
    }
  }
  return sortServiceDependencyDiagnostics(diagnostics)
}
