import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { LoadedService, SourceModule } from "../architecture/types.ts"
import { extractStaticSqlSource } from
  "../architecture/extract_static_sql_source.ts"
import { isRoutineMutation } from "../sql/is_routine_mutation.ts"
import { isRelationInvocationContext } from
  "../sql/is_relation_invocation_context.ts"
import { countSqlReferences } from "../sql/count_sql_references.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { hashSqlObjectReferences } from
  "../sql/hash_sql_object_references.ts"
import { buildRoutineAuthority } from "./build_routine_authority.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findRuntimeRoutineFindings(
  services: LoadedService[],
  modules: SourceModule[],
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  const authority = buildRoutineAuthority(services)
  const byKey = new Map(services.map((service) => [service.manifest.service_key, service]))
  for (const module of modules) {
    const subject = relative(workspaceRoot, module.path).replaceAll(sep, "/")
    if (subject.includes("/tests/")) continue
    const rawSource = module.path.endsWith(".sql")
      ? module.source
      : extractStaticSqlSource(module.path, module.source)
    const source = normalizeSqlIdentifiers(rawSource)
    const calls = new Set([...source.matchAll(
      /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(/gi,
    )].filter((match) => !isRelationInvocationContext(source, match.index))
      .map((match) => `${match[1].toLowerCase()}.${match[2].toLowerCase()}`))
    for (const routine of authority.owners.keys()) {
      if (isRoutineMutation(source, routine)) calls.add(routine)
    }
    for (const routine of [...calls].sort()) {
      const owner = authority.owners.get(routine)
      if (!owner) {
        if (authority.ownedSchemas.has(routine.split(".")[0])) findings.push({
          rule_version: 1,
          rule_id: "unowned_private_routine_call",
          subject,
          evidence: { routine, service_key: module.service_key },
          summary: `${module.service_key} calls unowned private routine ${routine}.`,
        })
        continue
      }
      if (owner === module.service_key) continue
      const consumer = byKey.get(module.service_key)
      const mutation = isRoutineMutation(source, routine)
      const authorized = !mutation &&
        (authority.publicRoutines.get(routine) ?? []).some((artifact) =>
        artifact.service === owner && consumer?.manifest.contracts.consumes.some(
          (dependency) => dependency.service === owner &&
            dependency.contract === artifact.contract,
        )
      )
      if (authorized) continue
      findings.push({
        rule_version: 1,
        rule_id: mutation
          ? "direct_private_routine_mutation"
          : "direct_private_routine_call",
        subject,
        evidence: {
          consumer_service: module.service_key,
          owner_service: owner,
          reference_count: countSqlReferences(source, routine),
          routine,
          sql_source_hash: hashSqlObjectReferences(source, routine),
        },
        summary: mutation
          ? `${module.service_key} mutates ${owner}'s ${routine}.`
          : `${module.service_key} directly calls ${owner}'s ${routine}.`,
      })
    }
    for (const [name, routines] of authority.names) {
      const unqualified = new RegExp(`(^|[^a-z0-9_.])${name}\\s*\\(`, "i")
      if (!unqualified.test(source)) continue
      findings.push({
        rule_version: 1,
        rule_id: "unqualified_private_routine_call",
        subject,
        evidence: { routine: routines.sort().join(","), service_key: module.service_key },
        summary: `${module.service_key} calls known routine ${name} unqualified.`,
      })
    }
  }
  return findings
}
