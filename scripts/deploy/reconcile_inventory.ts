import type { Architecture } from "../architecture/types.ts"
import type { EnvironmentKey, HostedFunction, InventoryResult } from "./types.ts"

export function reconcileInventory(
  architecture: Architecture,
  environment: EnvironmentKey,
  hosted: HostedFunction[],
  today = new Date().toISOString().slice(0, 10),
): InventoryResult {
  const active = architecture.functions.map((item) => item.slug).sort()
  const applicable = architecture.retirements.filter((item) =>
    item.environments.includes(environment)
  )
  const retired = applicable.filter((item) => item.remove_after >= today)
    .map((item) => item.function_slug).sort()
  const expired = applicable.filter((item) => item.remove_after < today)
    .map((item) => item.function_slug).sort()
  const hostedSlugs = new Set(hosted.map((item) => item.slug))
  const allowed = new Set([...active, ...retired])
  return {
    environment,
    active,
    retired,
    hosted,
    missing: active.filter((slug) => !hostedSlugs.has(slug)),
    unexpected: hosted.map((item) => item.slug).filter((slug) => !allowed.has(slug)),
    expired,
  }
}
