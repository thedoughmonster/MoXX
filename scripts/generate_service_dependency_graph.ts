import { buildServiceDependencyGraph } from
  "./architecture/build_service_dependency_graph.ts"
import { serviceDependencyGraphOutputPath } from "./architecture/paths.ts"
import { writeServiceDependencyGraph } from
  "./architecture/write_service_dependency_graph.ts"

const graph = await buildServiceDependencyGraph()
await writeServiceDependencyGraph(graph)
console.log(serviceDependencyGraphOutputPath)
