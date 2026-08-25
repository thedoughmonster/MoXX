import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { LoadedService, SourceModule } from "../architecture/types.ts"
import { extractStaticSqlSource } from
  "../architecture/extract_static_sql_source.ts"
import { findForeignSchemaAuthorityChanges } from
  "../sql/find_foreign_schema_authority_changes.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findRuntimeSchemaFindings(
  services: LoadedService[],
  modules: SourceModule[],
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  for (const module of modules) {
    const subject = relative(workspaceRoot, module.path).replaceAll(sep, "/")
    if (subject.includes("/tests/")) continue
    const rawSource = module.path.endsWith(".sql")
      ? module.source
      : extractStaticSqlSource(module.path, module.source)
    const source = normalizeSqlIdentifiers(rawSource)
    for (const change of findForeignSchemaAuthorityChanges(
      source,
      services,
      module.service_key,
    )) findings.push({
      rule_version: 1,
      rule_id: "foreign_schema_authority_change",
      subject,
      evidence: {
        actor_service: module.service_key,
        owner_services: change.owner_services,
        schema: change.schema,
      },
      summary: `${module.service_key} changes authority for foreign schema ${change.schema}.`,
    })
  }
  return findings
}
