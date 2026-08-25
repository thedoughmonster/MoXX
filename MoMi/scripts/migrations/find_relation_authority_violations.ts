import type { LoadedService } from "../architecture/types.ts"
import { findRelationAccess } from "../sql/find_relation_access.ts"

type PublicRead = { contract: string; service: string }

export function findRelationAuthorityViolations(
  source: string,
  file: string,
  actor: string,
  consumer: LoadedService,
  owners: Map<string, string>,
  publicReads: Map<string, PublicRead[]>,
): string[] {
  const violations: string[] = []
  for (const [relation, owner] of owners) {
    if (owner === actor) continue
    const access = findRelationAccess(source, relation)
    if (!access) continue
    const authorized = access === "read" &&
      (publicReads.get(relation) ?? []).some((artifact) =>
      artifact.service === owner && consumer.manifest.contracts.consumes.some(
        (dependency) => dependency.service === owner &&
          dependency.contract === artifact.contract,
      )
    )
    if (!authorized) violations.push(
      `${file}: ${actor} cannot ${access} ${relation} owned by ${owner}`,
    )
  }
  return violations
}
