import type { Architecture } from "../architecture/types.ts"
import { findHostedFunctionViolations } from "./find_hosted_function_violations.ts"
import { readFunctionVerifyJwt } from "./read_function_verify_jwt.ts"
import type { EnvironmentKey, HostedFunction, InventoryResult } from "./types.ts"

export function reconcileInventory(
  architecture: Architecture,
  environment: EnvironmentKey,
  hosted: HostedFunction[],
  today = new Date().toISOString().slice(0, 10),
  verifyJwt: ReadonlyMap<string, boolean> = readFunctionVerifyJwt(),
): InventoryResult {
  const active = architecture.functions.map((item) => item.slug).sort()
  const externallyOwned = architecture.externalFunctionAuthorities
    .filter((item) => item.environments.some((entry) => entry.name === environment))
    .map((item) => item.function_slug).sort()
  const applicable = architecture.retirements.filter((item) =>
    item.environments.includes(environment)
  )
  const hostedSlugs = new Set(hosted.map((item) => item.slug))
  const retired = applicable.filter((item) => item.remove_after >= today)
    .map((item) => item.function_slug).sort()
  const expired = applicable.filter((item) =>
    item.remove_after < today && hostedSlugs.has(item.function_slug)
  )
    .map((item) => item.function_slug).sort()
  const required = [...active, ...externallyOwned].sort()
  const allowed = new Set([...required, ...retired])
  return {
    environment,
    active,
    externally_owned: externallyOwned,
    retired,
    hosted,
    missing: required.filter((slug) => !hostedSlugs.has(slug)),
    unexpected: hosted.map((item) => item.slug).filter((slug) => !allowed.has(slug)),
    expired,
    invalid_metadata: findHostedFunctionViolations(
      architecture,
      environment,
      hosted,
      verifyJwt,
    ),
  }
}
