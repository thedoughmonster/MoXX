import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { ServiceDependencyGraphDiagnostic } from
  "./service_dependency_graph_types.ts"

export function findServiceDependencyEdgeDiagnostics(
  graph: Record<string, unknown>,
): ServiceDependencyGraphDiagnostic[] {
  if (!Array.isArray(graph.edges) || !Array.isArray(graph.nodes)) return []
  const diagnostics: ServiceDependencyGraphDiagnostic[] = []
  const nodes = new Set(graph.nodes.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return []
    const key = (value as Record<string, unknown>).service_key
    return typeof key === "string" ? [key] : []
  }))
  const tuples: string[][] = []
  const counts = new Map<string, number>()
  const outgoing = new Map([...nodes].map((key) => [key, new Set<string>()]))
  for (let index = 0; index < graph.edges.length; index += 1) {
    const value = graph.edges[index]
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const edge = value as Record<string, unknown>
    if (typeof edge.provider !== "string" ||
      typeof edge.consumer !== "string" ||
      typeof edge.contract !== "string") continue
    const tuple = [edge.provider, edge.consumer, edge.contract] as string[]
    const id = canonicalJson(tuple)
    tuples.push(tuple)
    counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const field of ["provider", "consumer"] as const) {
      if (!nodes.has(edge[field])) diagnostics.push({
        code: "unknown_node", field_path: `/edges/${index}/${field}`,
        expected: [...nodes].sort(compareUtf16), actual: edge[field],
      })
    }
    for (const field of ["provider", "consumer"] as const) {
      const pathField = `${field}_manifest_path`
      const expectedPath = `services/${edge[field]}/service.json`
      if (edge[pathField] !== expectedPath) diagnostics.push({
        code: "manifest_path_mismatch",
        field_path: `/edges/${index}/${pathField}`,
        expected: expectedPath, actual: edge[pathField],
      })
    }
    if (edge.provider === edge.consumer) diagnostics.push({
      code: "self_dependency", field_path: `/edges/${index}`,
      expected: "distinct provider and consumer", actual: edge.provider,
    })
    if (nodes.has(edge.provider) && nodes.has(edge.consumer) &&
      edge.provider !== edge.consumer) outgoing.get(edge.provider)?.add(edge.consumer)
  }
  for (const [id, count] of counts) {
    if (count > 1) diagnostics.push({
      code: "duplicate_edge", field_path: `/edges/${id}`,
      expected: 1, actual: count,
    })
  }
  const sortedTuples = [...tuples].sort((left, right) =>
    compareUtf16(left[0], right[0]) || compareUtf16(left[1], right[1]) ||
    compareUtf16(left[2], right[2])
  )
  if (canonicalJson(tuples) !== canonicalJson(sortedTuples)) diagnostics.push({
    code: "unsorted_edges", field_path: "/edges",
    expected: sortedTuples, actual: tuples,
  })
  const incoming = new Map([...nodes].map((key) => [key, 0]))
  for (const consumers of outgoing.values()) {
    for (const consumer of consumers) {
      incoming.set(consumer, (incoming.get(consumer) ?? 0) + 1)
    }
  }
  const ready = [...nodes].filter((key) => incoming.get(key) === 0)
    .sort(compareUtf16)
  const visited = new Set<string>()
  while (ready.length > 0) {
    const key = ready.shift() as string
    visited.add(key)
    for (const consumer of [...outgoing.get(key) ?? []].sort(compareUtf16)) {
      const count = (incoming.get(consumer) ?? 0) - 1
      incoming.set(consumer, count)
      if (count === 0) ready.push(consumer)
    }
    ready.sort(compareUtf16)
  }
  const cyclic = [...nodes].filter((key) => !visited.has(key)).sort(compareUtf16)
  if (cyclic.length > 0) diagnostics.push({
    code: "cycle_detected", field_path: "/edges",
    expected: "acyclic provider-to-consumer graph", actual: cyclic,
  })
  return diagnostics
}
