import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { assertArchitectureSnapshotIdentity } from
  "./assert_architecture_snapshot_identity.ts"
import { buildServiceDependencyGraph } from
  "./build_service_dependency_graph.ts"
import { findServiceDependencyGraphDiagnostics } from
  "./find_service_dependency_graph_diagnostics.ts"
import { serviceDependencyGraphSchemaPath } from "./paths.ts"
import { readJson } from "./read_json.ts"
import { sortServiceDependencyDiagnostics } from
  "./sort_service_dependency_diagnostics.ts"
import type { ServiceDependencyGraphDiagnostic } from
  "./service_dependency_graph_types.ts"
import { validateJson } from "./validate_json.ts"

export async function assertServiceDependencyGraph(
  expected: unknown,
): Promise<void> {
  const record = expected && typeof expected === "object" &&
      !Array.isArray(expected)
    ? expected as Record<string, unknown> : {}
  const diagnostics: ServiceDependencyGraphDiagnostic[] = []
  const schema = await readJson<object>(serviceDependencyGraphSchemaPath)
  try {
    validateJson(schema, expected, "service dependency graph")
  } catch (error) {
    diagnostics.push({
      code: "schema_invalid", field_path: "/",
      expected: "Service Dependency Graph v1",
      actual: error instanceof Error ? error.message : String(error),
    })
  }
  let snapshotValid = true
  try {
    await assertArchitectureSnapshotIdentity(record.source_snapshot)
  } catch (error) {
    snapshotValid = false
    diagnostics.push({
      code: "stale_snapshot", field_path: "/source_snapshot",
      expected: "current authoritative architecture snapshot",
      actual: error instanceof Error ? error.message : String(error),
    })
  }
  if (snapshotValid) {
    const actual = await buildServiceDependencyGraph()
    diagnostics.push(...findServiceDependencyGraphDiagnostics(expected, actual))
  } else {
    diagnostics.push(...findServiceDependencyGraphDiagnostics(expected))
  }
  const sorted = sortServiceDependencyDiagnostics(diagnostics)
  if (sorted.length > 0) {
    throw new Error(`service dependency graph mismatch: ${canonicalJson(sorted)}`)
  }
}
