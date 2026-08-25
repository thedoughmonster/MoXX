import assert from "node:assert/strict"
import test from "node:test"

import { assertServiceDependencyGraph } from
  "../scripts/architecture/assert_service_dependency_graph.ts"
import { provideServiceDependencyGraph } from
  "../scripts/architecture/provide_service_dependency_graph.ts"
import {
  createDependencyArchitecture,
  graphSourceSnapshot,
} from "./service_dependency_graph_fixture.ts"

test("reports strict and MOX-207 stale-snapshot assertion diagnostics", async () => {
  const graph = provideServiceDependencyGraph(createDependencyArchitecture([
    { key: "only-service", provides: [] },
  ]), graphSourceSnapshot)
  await assert.rejects(assertServiceDependencyGraph({
    ...graph,
    $schema: "https://momi.local/schemas/wrong.json",
    schema_version: 2,
    digest: "0".repeat(64),
  }), (error: unknown) => {
    assert(error instanceof Error)
    for (const code of [
      "schema_invalid", "schema_mismatch", "version_mismatch",
      "digest_mismatch", "stale_snapshot",
    ]) assert.match(error.message, new RegExp(code))
    return true
  })
})
