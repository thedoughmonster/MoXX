import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { compareUtf16 } from "../scripts/architecture/compare_utf16.ts"
import { digestServiceDependencyGraph } from
  "../scripts/architecture/digest_service_dependency_graph.ts"
import { findServiceDependencyGraphDiagnostics } from
  "../scripts/architecture/find_service_dependency_graph_diagnostics.ts"
import { provideServiceDependencyGraph } from
  "../scripts/architecture/provide_service_dependency_graph.ts"
import {
  createDependencyArchitecture,
  graphSourceSnapshot,
} from "./service_dependency_graph_fixture.ts"

const graph = provideServiceDependencyGraph(createDependencyArchitecture([
  { key: "alpha", provides: ["momi.alpha.v1", "momi.beta.v1"] },
  { key: "beta", provides: [], consumes: [{
    service: "alpha", contract: "momi.alpha.v1",
  }] },
  { key: "gamma", provides: [], consumes: [{
    service: "alpha", contract: "momi.beta.v1",
  }] },
]), graphSourceSnapshot)

test("finds sorted, duplicate, path, node, cycle, and digest diagnostics", () => {
  const cycleEdges = [{
    ...graph.edges[0], provider: "beta", consumer: "alpha",
    provider_manifest_path: "services/beta/service.json",
    consumer_manifest_path: "services/alpha/service.json",
  }, graph.edges[0]]
  const candidate = {
    ...graph,
    nodes: [...graph.nodes].reverse().concat({
      ...graph.nodes[0], manifest_path: "services/wrong/service.json",
    }),
    edges: cycleEdges.concat({
      ...graph.edges[0], provider: "absent",
      provider_manifest_path: "wrong",
    }, { ...cycleEdges[1], consumer_manifest_path: "services/wrong/service.json" }),
    digest: "0".repeat(64),
  }
  const first = findServiceDependencyGraphDiagnostics(candidate)
  const second = findServiceDependencyGraphDiagnostics(candidate)
  assert.deepEqual(first, second)
  const codes = new Set(first.map((item) => item.code))
  for (const code of [
    "cycle_detected", "digest_mismatch", "duplicate_edge", "duplicate_node",
    "manifest_path_mismatch", "unknown_node", "unsorted_edges", "unsorted_nodes",
  ]) assert(codes.has(code as never), code)
  assert(first.every((item) => canonicalJson(Object.keys(item).sort()) ===
    canonicalJson(["actual", "code", "expected", "field_path"])))
})

test("compares UTF-16 code units without locale behavior", () => {
  assert(compareUtf16("alpha", "beta") < 0)
  assert(compareUtf16("\u{1f600}", "\ue000") < 0)
  assert.equal(compareUtf16("same", "same"), 0)
})

test("compares the complete payload and excludes only digest from hashing", () => {
  const drifted = {
    ...graph,
    source_snapshot: { ...graph.source_snapshot, digest: "f".repeat(64) },
  }
  drifted.digest = digestServiceDependencyGraph(drifted)
  const diagnostics = findServiceDependencyGraphDiagnostics(drifted, graph)
  assert(diagnostics.some((item) =>
    item.code === "graph_mismatch" && item.field_path === "/source_snapshot"))
  assert.notEqual(drifted.digest, graph.digest)
  assert.equal(
    digestServiceDependencyGraph({ ...graph, digest: "0".repeat(64) }),
    digestServiceDependencyGraph(graph),
  )
})

test("emits exact four-field diagnostics", () => {
  const candidate = { ...graph, schema_version: 3 }
  candidate.digest = digestServiceDependencyGraph(candidate)
  assert.deepEqual(findServiceDependencyGraphDiagnostics(candidate), [{
    code: "version_mismatch", field_path: "/schema_version",
    expected: 2, actual: 3,
  }])
})
