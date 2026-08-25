import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { ServiceDependencyGraph } from
  "./service_dependency_graph_types.ts"

export function digestServiceDependencyGraph(
  graph: Omit<ServiceDependencyGraph, "digest"> | ServiceDependencyGraph,
): string {
  const { digest: _digest, ...payload } = graph as ServiceDependencyGraph
  return hashText(canonicalJson(payload))
}
