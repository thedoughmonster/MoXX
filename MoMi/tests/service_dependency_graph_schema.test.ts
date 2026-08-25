import assert from "node:assert/strict"
import test from "node:test"

import { serviceDependencyGraphSchemaPath } from
  "../scripts/architecture/paths.ts"
import { provideServiceDependencyGraph } from
  "../scripts/architecture/provide_service_dependency_graph.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import {
  createDependencyArchitecture,
  graphSourceSnapshot,
} from "./service_dependency_graph_fixture.ts"

const graph = provideServiceDependencyGraph(createDependencyArchitecture([
  { key: "provider", provides: ["momi.value.v1"] },
  { key: "consumer", provides: [], consumes: [{
    service: "provider", contract: "momi.value.v1",
  }] },
]), graphSourceSnapshot)

test("strict-validates the complete graph contract", async () => {
  const schema = await readJson<object>(serviceDependencyGraphSchemaPath)
  assert.doesNotThrow(() => validateJson(schema, graph, "graph"))
  const { edges: _edges, ...missingEdges } = graph
  const invalid = [
    missingEdges,
    { ...graph, unexpected: true },
    { ...graph, schema_version: 2 },
    { ...graph, digest: graph.digest.toUpperCase() },
    { ...graph, nodes: [{ ...graph.nodes[0], service_key: "Bad" }] },
    { ...graph, nodes: [{ ...graph.nodes[0], unexpected: true }] },
    { ...graph, nodes: [{ ...graph.nodes[0], manifest_path: "wrong" }] },
    { ...graph, nodes: [...graph.nodes, graph.nodes[0]] },
    { ...graph, edges: [{ ...graph.edges[0], contract: "not-versioned" }] },
    { ...graph, edges: [{ ...graph.edges[0], unexpected: true }] },
    { ...graph, edges: [...graph.edges, graph.edges[0]] },
    { ...graph, source_snapshot: {
      ...graph.source_snapshot, identity: {
        ...graph.source_snapshot.identity, commit: "short",
      },
    } },
  ]
  for (const candidate of invalid) {
    assert.throws(() => validateJson(schema, candidate, "graph"))
  }
})
