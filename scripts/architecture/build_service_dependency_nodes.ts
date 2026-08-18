import { compareUtf16 } from "./compare_utf16.ts"
import type { LoadedService } from "./types.ts"
import type { ServiceDependencyNode } from
  "./service_dependency_graph_types.ts"

export function buildServiceDependencyNodes(
  services: LoadedService[],
): ServiceDependencyNode[] {
  return services.map(({ manifest }) => ({
    service_key: manifest.service_key,
    manifest_path: `services/${manifest.service_key}/service.json`,
  })).sort((left, right) => compareUtf16(left.service_key, right.service_key))
}
