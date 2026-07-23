import type { Architecture, LoadedFunction } from "../architecture/types.ts"

export function selectFunctions(
  architecture: Architecture,
  services: string[],
): LoadedFunction[] {
  const requested = new Set(services)
  const selected = architecture.functions.filter(
    (item) => requested.has(item.service.manifest.service_key),
  )
  const known = new Set(architecture.services.map((item) => item.manifest.service_key))
  const unknown = services.filter((service) => !known.has(service))
  if (unknown.length > 0) throw new Error(`Unknown services: ${unknown.join(", ")}`)
  if (selected.length === 0) throw new Error("Selected services own no functions")
  return selected.sort((left, right) => left.slug.localeCompare(right.slug))
}
