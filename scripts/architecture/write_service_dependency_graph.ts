import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { serviceDependencyGraphOutputPath } from "./paths.ts"
import type { ServiceDependencyGraph } from
  "./service_dependency_graph_types.ts"

export async function writeServiceDependencyGraph(
  graph: ServiceDependencyGraph,
): Promise<void> {
  await mkdir(dirname(serviceDependencyGraphOutputPath), { recursive: true })
  await writeFile(serviceDependencyGraphOutputPath, canonicalJson(graph), "utf8")
}
