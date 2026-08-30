import assert from "node:assert/strict"
import { readFile, rm } from "node:fs/promises"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { serviceDependencyGraphOutputPath } from
  "../scripts/architecture/paths.ts"
import { provideServiceDependencyGraph } from
  "../scripts/architecture/provide_service_dependency_graph.ts"
import { writeServiceDependencyGraph } from
  "../scripts/architecture/write_service_dependency_graph.ts"
import {
  createDependencyArchitecture,
  graphSourceSnapshot,
} from "./service_dependency_graph_fixture.ts"

test("writes only canonical bytes without a trailing newline", async (t) => {
  t.after(() => rm(serviceDependencyGraphOutputPath, { force: true }))
  const graph = provideServiceDependencyGraph(createDependencyArchitecture([
    { key: "only-service", provides: [] },
  ]), graphSourceSnapshot)
  await writeServiceDependencyGraph(graph)
  const bytes = await readFile(serviceDependencyGraphOutputPath)
  assert.equal(bytes.toString("utf8"), canonicalJson(graph))
  assert.notEqual(bytes.at(-1), 0x0a)
  assert.match(
    serviceDependencyGraphOutputPath,
    /\/\.momi\/architecture\/service-dependency-graph-v2\.json$/,
  )
})
