import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { ServiceDependencyGraphDiagnostic } from
  "./service_dependency_graph_types.ts"

export function findServiceDependencyNodeDiagnostics(
  graph: Record<string, unknown>,
): ServiceDependencyGraphDiagnostic[] {
  if (!Array.isArray(graph.nodes)) return []
  const diagnostics: ServiceDependencyGraphDiagnostic[] = []
  const keys: string[] = []
  const counts = new Map<string, number>()
  for (let index = 0; index < graph.nodes.length; index += 1) {
    const value = graph.nodes[index]
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const node = value as Record<string, unknown>
    if (typeof node.service_key !== "string") continue
    const key = node.service_key
    keys.push(key)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    const expectedPath = `services/${key}/service.json`
    if (node.manifest_path !== expectedPath) diagnostics.push({
      code: "manifest_path_mismatch",
      field_path: `/nodes/${index}/manifest_path`,
      expected: expectedPath, actual: node.manifest_path,
    })
  }
  for (const [key, count] of counts) {
    if (count > 1) diagnostics.push({
      code: "duplicate_node", field_path: `/nodes/${key}`,
      expected: 1, actual: count,
    })
  }
  const sorted = [...keys].sort(compareUtf16)
  if (canonicalJson(keys) !== canonicalJson(sorted)) diagnostics.push({
    code: "unsorted_nodes", field_path: "/nodes",
    expected: sorted, actual: keys,
  })
  return diagnostics
}
