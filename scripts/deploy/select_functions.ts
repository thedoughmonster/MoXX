import type { Architecture, LoadedFunction } from "../architecture/types.ts"

export function selectFunctions(
  architecture: Architecture,
  service: string,
): LoadedFunction[] {
  if (service === "all") return architecture.functions
  const selected = architecture.functions.filter(
    (item) => item.service.manifest.service_key === service,
  )
  if (selected.length === 0) throw new Error(`Unknown service: ${service}`)
  return selected
}
