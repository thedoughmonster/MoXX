import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { provideServiceDependencyGraph } from
  "../scripts/architecture/provide_service_dependency_graph.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"
import { graphSourceSnapshot } from "./service_dependency_graph_fixture.ts"

test("projects the accepted current dev service graph exactly", async () => {
  const architecture = await validateArchitecture()
  const graph = provideServiceDependencyGraph(architecture, graphSourceSnapshot)
  const provided = architecture.services.flatMap(
    (service) => service.manifest.contracts.provides,
  )
  assert.equal(graph.nodes.length, 29)
  assert.equal(graph.edges.length, 43)
  assert.equal(new Set(provided).size, 76)
  assert.equal(provided.length, 76)
  assert.equal(new Set(graph.nodes.map((node) => node.service_key)).size, 29)
  assert.equal(new Set(graph.edges.map((edge) => canonicalJson([
    edge.provider, edge.consumer, edge.contract,
  ]))).size, 43)
  for (const edge of graph.edges) {
    const consumer = architecture.services.find(
      (service) => service.manifest.service_key === edge.consumer,
    )
    assert(consumer?.manifest.contracts.consumes.some((dependency) =>
      dependency.service === edge.provider && dependency.contract === edge.contract))
  }
})
