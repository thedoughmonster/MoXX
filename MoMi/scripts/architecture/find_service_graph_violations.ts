import type { LoadedService } from "./types.ts"

export function findServiceGraphViolations(
  services: LoadedService[],
): string[] {
  const violations: string[] = []
  const byKey = new Map(services.map((service) => [service.manifest.service_key, service]))
  const incoming = new Map(services.map((service) => [service.manifest.service_key, 0]))
  const outgoing = new Map(services.map((service) => [service.manifest.service_key, new Set<string>()]))

  for (const consumer of services) {
    for (const dependency of consumer.manifest.contracts.consumes) {
      const provider = byKey.get(dependency.service)
      if (!provider) {
        violations.push(`${consumer.manifest.service_key}: unknown provider ${dependency.service}`)
        continue
      }
      if (!provider.manifest.contracts.provides.includes(dependency.contract)) {
        violations.push(`${dependency.service}: does not provide ${dependency.contract}`)
      }
      const consumers = outgoing.get(dependency.service) as Set<string>
      if (!consumers.has(consumer.manifest.service_key)) {
        consumers.add(consumer.manifest.service_key)
        incoming.set(
          consumer.manifest.service_key,
          (incoming.get(consumer.manifest.service_key) ?? 0) + 1,
        )
      }
    }
  }

  const ready = [...incoming.entries()].filter(([, count]) => count === 0)
    .map(([key]) => key)
  let visited = 0
  while (ready.length > 0) {
    const key = ready.pop() as string
    visited += 1
    for (const consumer of outgoing.get(key) ?? []) {
      const count = (incoming.get(consumer) ?? 0) - 1
      incoming.set(consumer, count)
      if (count === 0) {
        ready.push(consumer)
      }
    }
  }
  if (visited !== services.length) {
    violations.push("service contract graph contains a cycle")
  }

  return violations
}
