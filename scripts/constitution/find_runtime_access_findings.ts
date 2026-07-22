import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { LoadedService, SourceModule } from "../architecture/types.ts"
import { extractStaticSqlSource } from
  "../architecture/extract_static_sql_source.ts"
import { findRelationAccess } from "../sql/find_relation_access.ts"
import { countSqlReferences } from "../sql/count_sql_references.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { findUnqualifiedRelationReferences } from
  "../sql/find_unqualified_relation_references.ts"
import { hashSqlObjectReferences } from
  "../sql/hash_sql_object_references.ts"
import { findDynamicSqlExpressions } from "./find_dynamic_sql_expressions.ts"
import { finalizeFindings } from "./finalize_findings.ts"
import { findRuntimeEventFindings } from "./find_runtime_event_findings.ts"
import { findRuntimeRoutineFindings } from "./find_runtime_routine_findings.ts"
import { findRuntimeSchemaFindings } from "./find_runtime_schema_findings.ts"
import { hashServiceSource } from "./hash_service_source.ts"
import { isDeclaredDynamicRead } from "./is_declared_dynamic_read.ts"
import type { ConstitutionFinding, ConstitutionFindingInput } from "./types.ts"

export function findRuntimeAccessFindings(
  services: LoadedService[],
  modules: SourceModule[],
): ConstitutionFinding[] {
  const findings: ConstitutionFindingInput[] = []
  const owners = new Map<string, string>()
  const relationNames = new Set<string>()
  const publicReads = new Map<string, Array<{ contract: string; service: string }>>()
  const byKey = new Map(services.map((service) => [service.manifest.service_key, service]))
  for (const service of services) {
    const key = service.manifest.service_key
    for (const relation of service.manifest.owned_dataset?.private_relations ?? []) {
      owners.set(relation, key)
      relationNames.add(relation.split(".")[1])
    }
    for (const artifact of service.manifest.owned_dataset?.public_relation_reads ?? []) {
      const entries = publicReads.get(artifact.relation) ?? []
      entries.push({ contract: artifact.contract, service: key })
      publicReads.set(artifact.relation, entries)
    }
  }
  for (const module of modules) {
    const subject = relative(workspaceRoot, module.path).replaceAll(sep, "/")
    if (subject.includes("/tests/")) continue
    const rawSource = module.path.endsWith(".sql")
      ? module.source
      : extractStaticSqlSource(module.path, module.source)
    const source = normalizeSqlIdentifiers(rawSource)
    const dynamicExpressions = module.path.endsWith(".sql")
      ? (/\bexecute\b/i.test(source) ? ["EXECUTE"] : [])
      : findDynamicSqlExpressions(module.path, module.source)
    const owner = byKey.get(module.service_key)
    if (dynamicExpressions.length > 0 &&
      !isDeclaredDynamicRead(owner, services, module, subject, source)) findings.push({
      rule_version: 1,
      rule_id: "dynamic_relation_identifier",
      subject,
      evidence: {
        expressions: [...new Set(dynamicExpressions)].join("|"),
        service_key: module.service_key,
        service_source_hash: hashServiceSource(
          modules.filter((item) => item.path.endsWith(module.path.endsWith(".sql")
            ? ".sql"
            : ".ts")),
          module.service_key,
        ),
      },
      summary: `${module.service_key} constructs a runtime SQL identifier dynamically.`,
    })
    for (const relationName of findUnqualifiedRelationReferences(
      source, relationNames,
    )) findings.push({
      rule_version: 1,
      rule_id: "unqualified_relation_access",
      subject,
      evidence: { relation_name: relationName, service_key: module.service_key },
      summary: `${module.service_key} references known relation ${relationName} unqualified.`,
    })
    for (const [relation, owner] of owners) {
      if (owner === module.service_key) continue
      const access = findRelationAccess(source, relation)
      if (!access) continue
      const consumer = byKey.get(module.service_key)
      const authorized = access === "read" &&
        (publicReads.get(relation) ?? []).some((artifact) =>
        artifact.service === owner && consumer?.manifest.contracts.consumes.some(
          (dependency) => dependency.service === owner &&
            dependency.contract === artifact.contract,
        )
      )
      if (authorized) continue
      findings.push({
        rule_version: 1,
        rule_id: "direct_private_relation_access",
        subject,
        evidence: {
          access,
          consumer_service: module.service_key,
          owner_service: owner,
          reference_count: countSqlReferences(source, relation),
          relation,
          sql_source_hash: hashSqlObjectReferences(source, relation),
        },
        summary: `${module.service_key} directly ${access}s ${owner}'s ${relation}.`,
      })
    }
  }
  return finalizeFindings([
    ...findings,
    ...findRuntimeEventFindings(services, modules),
    ...findRuntimeRoutineFindings(services, modules),
    ...findRuntimeSchemaFindings(services, modules),
  ])
}
