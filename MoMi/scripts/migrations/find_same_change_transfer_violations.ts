import type { AuthoritySnapshot } from
  "../constitution/load_target_authority_snapshot.ts"
import { findRelationAccess } from "../sql/find_relation_access.ts"
import { isRoutineMutation } from "../sql/is_routine_mutation.ts"

export function findSameChangeTransferViolations(
  source: string,
  file: string,
  actor: string,
  candidateRelations: Map<string, string>,
  candidateRoutines: Map<string, string>,
  trusted?: AuthoritySnapshot,
): string[] {
  if (!trusted) return []
  const violations: string[] = []
  for (const [relation, former] of trusted.relationOwners) {
    const next = candidateRelations.get(relation)
    if (!next || next === former || findRelationAccess(source, relation) !== "write") {
      continue
    }
    violations.push(
      `${file}: ${actor} cannot mutate ${relation} while ownership transfers ` +
        `from ${former} to ${next}`,
    )
  }
  for (const [routine, former] of trusted.routineOwners) {
    const next = candidateRoutines.get(routine)
    if (!next || next === former || !isRoutineMutation(source, routine)) continue
    violations.push(
      `${file}: ${actor} cannot mutate ${routine} while ownership transfers ` +
        `from ${former} to ${next}`,
    )
  }
  return violations
}
