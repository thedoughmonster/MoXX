import type { LoadedService } from "../architecture/types.ts"
import type { AuthoritySnapshot } from "../constitution/load_target_authority_snapshot.ts"
import { buildRoutineAuthority } from "../constitution/build_routine_authority.ts"
import { findForeignSchemaAuthorityChanges } from "../sql/find_foreign_schema_authority_changes.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { findUnqualifiedRelationReferences } from "../sql/find_unqualified_relation_references.ts"
import { assertSupportedPersistentDdl } from "./assert_supported_persistent_ddl.ts"
import { findIndexAuthorityViolations } from "./find_index_authority_violations.ts"
import { findRoleAuthorityChanges } from "./find_role_authority_changes.ts"
import { findRelationAuthorityViolations } from
  "./find_relation_authority_violations.ts"
import { findSameChangeTransferViolations } from
  "./find_same_change_transfer_violations.ts"
import { findMigrationRoutineAuthorityViolations } from "./find_migration_routine_authority_violations.ts"
import { hasDeclaredDynamicMigrationRead } from "./has_declared_dynamic_migration_read.ts"
export function findNewMigrationAuthorityViolations(
  baseline: Map<string, string>,
  current: Map<string, string>,
  services: LoadedService[],
  trusted?: AuthoritySnapshot,
): string[] {
  const violations: string[] = []
  const owners = new Map<string, string>()
  const candidateOwners = new Map<string, string>()
  const relations = new Set<string>()
  const relationNames = new Set<string>()
  const publicReads = new Map<string, Array<{ contract: string; service: string }>>()
  const byKey = new Map(services.map((service) => [service.manifest.service_key, service]))
  const routineAuthority = buildRoutineAuthority(services)
  const candidateRoutineOwners = new Map(routineAuthority.owners)
  for (const service of services) {
    const key = service.manifest.service_key
    for (const relation of service.manifest.owned_dataset?.private_relations ?? []) {
      owners.set(relation, key)
      candidateOwners.set(relation, key)
      relations.add(relation)
      relationNames.add(relation.split(".")[1])
    }
    for (const artifact of service.manifest.owned_dataset?.public_relation_reads ?? []) {
      const entries = publicReads.get(artifact.relation) ?? []
      entries.push({ contract: artifact.contract, service: key })
      publicReads.set(artifact.relation, entries)
    }
  }
  for (const [relation, owner] of trusted?.relationOwners ?? []) {
    owners.set(relation, owner)
    relations.add(relation)
    relationNames.add(relation.split(".")[1])
  }
  for (const [routine, owner] of trusted?.routineOwners ?? []) {
    routineAuthority.owners.set(routine, owner)
    routineAuthority.ownedSchemas.add(routine.split(".")[0])
    const name = routine.split(".")[1]
    const entries = routineAuthority.names.get(name) ?? []
    if (!entries.includes(routine)) entries.push(routine)
    routineAuthority.names.set(name, entries)
  }
  violations.push(...findIndexAuthorityViolations(baseline, current, owners))
  for (const [file, source] of current) {
    if (baseline.has(file)) continue
    const migrationOwner = source.match(
      /^-- service-owner: ([a-z][a-z0-9-]+)$/m,
    )?.[1]
    const consumer = migrationOwner ? byKey.get(migrationOwner) : undefined
    if (!migrationOwner || !consumer) continue
    const normalized = normalizeSqlIdentifiers(source)
    assertSupportedPersistentDdl(file, source)
    if (/\bU&\s*"/i.test(source)) {
      violations.push(`${file}: Unicode SQL identifiers are forbidden`)
    }
    const procedural = normalized
      .replace(/\bcreate\s+(?:constraint\s+)?trigger\b[^;]*?\bexecute\s+(?:function|procedure)\b[^;]*;/gi, "")
      .replace(/\b(?:grant|revoke)\b[^;]*;/gi, "")
    const declaredDynamic = hasDeclaredDynamicMigrationRead(
      consumer, services, normalized,
    )
    if (/\bexecute\b/i.test(procedural) && !declaredDynamic) {
      violations.push(`${file}: dynamic SQL relation authority is forbidden`)
    }
    for (const change of findRoleAuthorityChanges(normalized,
      consumer.manifest.owned_dataset?.db_role,
      consumer.manifest.owned_dataset?.dynamic_read_routines ?? [],
    )) {
      violations.push(`${file}: ${change}`)
    }
    violations.push(...findSameChangeTransferViolations(
      normalized,
      file,
      migrationOwner,
      candidateOwners,
      candidateRoutineOwners,
      trusted,
    ))
    for (const change of findForeignSchemaAuthorityChanges(
      normalized,
      services,
      migrationOwner,
      trusted?.schemaOwners,
    )) violations.push(
      `${file}: ${migrationOwner} cannot change authority for schema ` +
        `${change.schema} owned by ${change.owner_services}`,
    )
    for (const relation of findUnqualifiedRelationReferences(
      normalized, relationNames,
    )) {
      violations.push(`${file}: known relation ${relation} must be schema-qualified`)
    }
    violations.push(...findMigrationRoutineAuthorityViolations(
      normalized,
      file,
      migrationOwner,
      consumer,
      routineAuthority,
    ))
    violations.push(...findRelationAuthorityViolations(
      normalized, file, migrationOwner, consumer, owners, publicReads,
    ))
  }
  return violations.sort()
}
