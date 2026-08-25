import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { LoadedService, SourceModule } from "../architecture/types.ts"
import { extractStaticSqlSource } from
  "../architecture/extract_static_sql_source.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { hashServiceSource } from "./hash_service_source.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findRuntimeEventFindings(
  services: LoadedService[],
  modules: SourceModule[],
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  const declared = new Map<string, string>()
  for (const service of services) for (const event of
    service.manifest.owned_dataset?.emitted_events ?? []) {
    declared.set(event, service.manifest.service_key)
  }
  const insertion = /insert\s+into\s+momi_events\.events\s*\(\s*event_name\b[\s\S]*?\)\s*(?:values\s*\(\s*|select\s+)([^,\r\n]+)/gi
  const exactEvent = /^'((?:source|warehouse)(?:\.[a-z][a-z0-9_]*){2,})'$/i
  for (const module of modules) {
    const subject = relative(workspaceRoot, module.path).replaceAll(sep, "/")
    if (subject.includes("/tests/")) continue
    const raw = module.path.endsWith(".sql")
      ? module.source
      : extractStaticSqlSource(module.path, module.source)
    const source = normalizeSqlIdentifiers(raw)
    const dynamic = new Set<string>()
    for (const match of source.matchAll(insertion)) {
      const expression = match[1].trim().replace(/\s+/g, " ")
      const event = expression.match(exactEvent)?.[1]?.toLowerCase()
      if (!event) {
        dynamic.add(expression.slice(0, 160))
        continue
      }
      if (declared.get(event) === module.service_key) continue
      findings.push({
        rule_version: 1,
        rule_id: "undeclared_event_emission",
        subject,
        evidence: {
          declared_owner: declared.get(event) ?? "undeclared",
          event,
          service_key: module.service_key,
        },
        summary: `${module.service_key} emits ${event} without owning its declaration.`,
      })
    }
    if (dynamic.size === 0) continue
    findings.push({
      rule_version: 1,
      rule_id: "dynamic_event_name",
      subject,
      evidence: {
        expressions: [...dynamic].sort().join("|"),
        service_key: module.service_key,
        service_source_hash: hashServiceSource(
          modules.filter((item) => item.path.endsWith(
            module.path.endsWith(".sql") ? ".sql" : ".ts",
          )),
          module.service_key,
        ),
      },
      summary: `${module.service_key} constructs an event identity dynamically.`,
    })
  }
  return findings
}
