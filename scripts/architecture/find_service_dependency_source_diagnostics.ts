import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { sortServiceDependencyDiagnostics } from
  "./sort_service_dependency_diagnostics.ts"
import type { LoadedService } from "./types.ts"
import type { ServiceDependencyGraphDiagnostic } from
  "./service_dependency_graph_types.ts"

export function findServiceDependencySourceDiagnostics(
  services: LoadedService[],
): ServiceDependencyGraphDiagnostic[] {
  const diagnostics: ServiceDependencyGraphDiagnostic[] = []
  const serviceGroups = new Map<string, LoadedService[]>()
  const providers = new Map<string, string[]>()
  for (const service of services) {
    const key = service.manifest.service_key
    serviceGroups.set(key, [...serviceGroups.get(key) ?? [], service])
    for (const contract of service.manifest.contracts.provides) {
      providers.set(contract, [...providers.get(contract) ?? [], key])
    }
  }
  const serviceKeys = [...serviceGroups.keys()].sort(compareUtf16)
  for (const [key, matches] of serviceGroups) {
    if (matches.length > 1) diagnostics.push({
      code: "duplicate_node", field_path: `/nodes/${key}`,
      expected: 1, actual: matches.length,
    })
  }
  for (const [contract, keys] of providers) {
    if (keys.length > 1) diagnostics.push({
      code: "duplicate_provided_contract",
      field_path: `/contracts/provides/${contract}`,
      expected: 1, actual: [...keys].sort(compareUtf16),
    })
  }
  const edgeIds = new Map<string, number>()
  const outgoing = new Map(serviceKeys.map((key) => [key, new Set<string>()]))
  for (const service of services) {
    const consumer = service.manifest.service_key
    for (const dependency of service.manifest.contracts.consumes) {
      const provider = dependency.service
      const edgeId = canonicalJson([provider, consumer, dependency.contract])
      edgeIds.set(edgeId, (edgeIds.get(edgeId) ?? 0) + 1)
      if (!serviceGroups.has(provider)) diagnostics.push({
        code: "unknown_provider", field_path: `/edges/${edgeId}/provider`,
        expected: serviceKeys, actual: provider,
      })
      else if (!serviceGroups.get(provider)?.[0].manifest.contracts.provides
        .includes(dependency.contract)) diagnostics.push({
          code: "missing_provider_contract",
          field_path: `/edges/${edgeId}/contract`,
          expected: [...serviceGroups.get(provider)?.[0].manifest.contracts
            .provides ?? []].sort(compareUtf16), actual: dependency.contract,
        })
      if (provider === consumer) diagnostics.push({
        code: "self_dependency", field_path: `/edges/${edgeId}`,
        expected: "distinct provider and consumer", actual: provider,
      })
      if (serviceGroups.has(provider) && provider !== consumer) {
        outgoing.get(provider)?.add(consumer)
      }
    }
  }
  for (const [edgeId, count] of edgeIds) {
    if (count > 1) diagnostics.push({
      code: "duplicate_edge", field_path: `/edges/${edgeId}`,
      expected: 1, actual: count,
    })
  }
  const incoming = new Map(serviceKeys.map((key) => [key, 0]))
  for (const consumers of outgoing.values()) {
    for (const consumer of consumers) {
      incoming.set(consumer, (incoming.get(consumer) ?? 0) + 1)
    }
  }
  const ready = serviceKeys.filter((key) => incoming.get(key) === 0)
  const visited = new Set<string>()
  while (ready.length > 0) {
    const key = ready.shift() as string
    visited.add(key)
    for (const consumer of [...outgoing.get(key) ?? []].sort(compareUtf16)) {
      const count = (incoming.get(consumer) ?? 0) - 1
      incoming.set(consumer, count)
      if (count === 0) ready.push(consumer)
    }
    ready.sort(compareUtf16)
  }
  const cyclic = serviceKeys.filter((key) => !visited.has(key))
  if (cyclic.length > 0) diagnostics.push({
    code: "cycle_detected", field_path: "/edges",
    expected: "acyclic provider-to-consumer graph", actual: cyclic,
  })
  return sortServiceDependencyDiagnostics(diagnostics)
}
