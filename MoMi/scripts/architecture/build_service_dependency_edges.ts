import { compareUtf16 } from "./compare_utf16.ts"
import type { LoadedService } from "./types.ts"
import type { ServiceDependencyEdge } from
  "./service_dependency_graph_types.ts"

export function buildServiceDependencyEdges(
  services: LoadedService[],
): ServiceDependencyEdge[] {
  const edges = services.flatMap(({ manifest: consumer }) =>
    consumer.contracts.consumes.map(({ service: provider, contract }) => ({
      provider,
      consumer: consumer.service_key,
      contract,
      provider_manifest_path: `services/${provider}/service.json`,
      consumer_manifest_path: `services/${consumer.service_key}/service.json`,
    })))
  return edges.sort((left, right) =>
    compareUtf16(left.provider, right.provider) ||
    compareUtf16(left.consumer, right.consumer) ||
    compareUtf16(left.contract, right.contract)
  )
}
