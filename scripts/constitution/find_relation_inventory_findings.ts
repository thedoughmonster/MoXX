import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findRelationInventoryFindings(
  services: LoadedService[],
  inventory: Map<string, string>,
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  const declarations = new Map<string, string>()
  for (const service of services) {
    for (const relation of service.manifest.owned_dataset?.private_relations ?? []) {
      declarations.set(relation, service.manifest.service_key)
    }
  }
  for (const [relation, kind] of inventory) {
    if (declarations.has(relation)) continue
    findings.push({
      rule_version: 1,
      rule_id: "relation_owner_missing",
      subject: `relation:${relation}`,
      evidence: { relation, relation_kind: kind },
      summary: `${kind} ${relation} has no declared dataset owner.`,
    })
  }
  for (const [relation, serviceKey] of declarations) {
    if (inventory.has(relation)) continue
    findings.push({
      rule_version: 1,
      rule_id: "relation_declaration_unknown",
      subject: `relation:${relation}`,
      evidence: { relation, service_key: serviceKey },
      summary: `${serviceKey} claims relation ${relation}, which migration history does not create.`,
    })
  }
  return findings
}
