import type { ExternalFunctionAuthority } from
  "./external_function_authority_types.ts"
import type { LoadedFunction, RetirementManifest } from "./types.ts"

export function findExternalFunctionAuthorityConflicts(
  authorities: ExternalFunctionAuthority[],
  retirements: RetirementManifest[],
  functions: LoadedFunction[],
): string[] {
  const localSlugs = new Set(functions.map((item) => item.slug))
  const externalKeys = new Set(authorities.flatMap((item) =>
    item.environments.map((entry) => `${entry.name}:${item.function_slug}`)
  ))
  const conflicts: string[] = []
  for (const authority of authorities) {
    if (localSlugs.has(authority.function_slug)) {
      conflicts.push(
        `${authority.function_slug}: cannot be locally and externally owned`,
      )
    }
  }
  for (const retirement of retirements) {
    if (retirement.environments.some((entry) =>
      externalKeys.has(`${entry}:${retirement.function_slug}`)
    )) {
      conflicts.push(
        `${retirement.function_slug}: cannot be externally owned and retiring`,
      )
    }
  }
  return conflicts.sort()
}
