import type { LoadedService } from "../architecture/types.ts"
import type { RoutineAuthority } from "../constitution/build_routine_authority.ts"
import { isRoutineMutation } from "../sql/is_routine_mutation.ts"
import { isRelationInvocationContext } from
  "../sql/is_relation_invocation_context.ts"

export function findMigrationRoutineAuthorityViolations(
  source: string,
  file: string,
  actor: string,
  consumer: LoadedService,
  authority: RoutineAuthority,
): string[] {
  const violations: string[] = []
  for (const [name, routines] of authority.names) {
    const pattern = new RegExp(`(^|[^a-z0-9_.])${name}\\s*\\(`, "i")
    if (pattern.test(source)) violations.push(
      `${file}: known routine ${routines.sort().join(",")} must be schema-qualified`,
    )
  }
  const calls = new Set([...source.matchAll(
    /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(/gi,
  )].filter((match) => !isRelationInvocationContext(source, match.index))
    .map((match) => `${match[1].toLowerCase()}.${match[2].toLowerCase()}`))
  for (const routine of authority.owners.keys()) {
    if (isRoutineMutation(source, routine)) calls.add(routine)
  }
  for (const match of source.matchAll(
    /\b(?:create(?:\s+or\s+replace)?|alter|drop)\s+(?:function|procedure|routine)\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\b/gi,
  )) calls.add(match[1].toLowerCase())
  for (const routine of [...calls].sort()) {
    const schema = routine.split(".")[0]
    const owner = authority.owners.get(routine)
    if (!owner) {
      if (authority.ownedSchemas.has(schema)) violations.push(
        `${file}: ${actor} cannot use unowned routine ${routine}`,
      )
      continue
    }
    if (owner === actor) continue
    const mutation = isRoutineMutation(source, routine)
    const authorized = !mutation &&
      (authority.publicRoutines.get(routine) ?? []).some((artifact) =>
        artifact.service === owner && consumer.manifest.contracts.consumes.some(
          (dependency) => dependency.service === owner &&
            dependency.contract === artifact.contract,
        )
      )
    if (!authorized) violations.push(mutation
      ? `${file}: ${actor} cannot mutate ${routine} owned by ${owner}`
      : `${file}: ${actor} cannot call ${routine} owned by ${owner}`)
  }
  return violations
}
