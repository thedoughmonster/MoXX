import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { digestServiceDependencyGraph } from
  "../scripts/architecture/digest_service_dependency_graph.ts"
import { provideServiceDependencyGraph } from
  "../scripts/architecture/provide_service_dependency_graph.ts"
import { ServiceDependencyGraphError } from
  "../scripts/architecture/service_dependency_graph_types.ts"
import {
  createDependencyArchitecture,
  graphSourceSnapshot,
} from "./service_dependency_graph_fixture.ts"

const definitions = [{ key: "z-provider", provides: ["momi.z.v1"] }, {
  key: "a-consumer", provides: [],
  consumes: [{ service: "z-provider", contract: "momi.z.v1" }],
}]

test("provides canonical nodes, provider-to-consumer edges, and digest", () => {
  const first = provideServiceDependencyGraph(
    createDependencyArchitecture(definitions), graphSourceSnapshot,
  )
  const reordered = provideServiceDependencyGraph(
    createDependencyArchitecture([...definitions].reverse()), graphSourceSnapshot,
  )
  assert.equal(canonicalJson(first), canonicalJson(reordered))
  assert.deepEqual(first.nodes.map((node) => node.service_key), [
    "a-consumer", "z-provider",
  ])
  assert.deepEqual(first.edges[0], {
    provider: "z-provider", consumer: "a-consumer", contract: "momi.z.v1",
    provider_manifest_path: "services/z-provider/service.json",
    consumer_manifest_path: "services/a-consumer/service.json",
  })
  assert.equal(first.digest, digestServiceDependencyGraph(first))
  assert.notEqual(digestServiceDependencyGraph({
    ...first, nodes: [{ ...first.nodes[0], service_key: "drift" }, first.nodes[1]],
  }), first.digest)
})

test("fails closed for invalid manifest dependency sources", () => {
  const cases = [["duplicate_node", [definitions[0], definitions[0]]],
    ["duplicate_provided_contract", [
      definitions[0], { key: "other", provides: ["momi.z.v1"] },
    ]], ["unknown_provider", [{
      key: "consumer", provides: [],
      consumes: [{ service: "absent", contract: "momi.z.v1" }],
    }]], ["missing_provider_contract", [
      { key: "actual-provider", provides: ["momi.z.v1"] },
      { key: "named-provider", provides: [] }, {
      key: "consumer", provides: [],
      consumes: [{ service: "named-provider", contract: "momi.z.v1" }],
    }]], ["self_dependency", [{
      key: "self", provides: ["momi.self.v1"],
      consumes: [{ service: "self", contract: "momi.self.v1" }],
    }]], ["duplicate_edge", [{ key: "provider", provides: ["momi.z.v1"] }, {
      key: "consumer", provides: [], consumes: [
        { service: "provider", contract: "momi.z.v1" },
        { service: "provider", contract: "momi.z.v1" },
      ],
    }]], ["cycle_detected", [{
      key: "alpha", provides: ["momi.alpha.v1"],
      consumes: [{ service: "beta", contract: "momi.beta.v1" }],
    }, {
      key: "beta", provides: ["momi.beta.v1"],
      consumes: [{ service: "alpha", contract: "momi.alpha.v1" }],
    }]]] as const
  for (const [code, input] of cases) assert.throws(
    () => provideServiceDependencyGraph(
      createDependencyArchitecture([...input]), graphSourceSnapshot,
    ),
    (error: unknown) => error instanceof ServiceDependencyGraphError &&
      error.diagnostics.some((diagnostic) => diagnostic.code === code),
  )
})
