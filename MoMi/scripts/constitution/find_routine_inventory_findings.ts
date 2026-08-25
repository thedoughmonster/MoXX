import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findRoutineInventoryFindings(
  services: LoadedService[],
  inventory: Set<string>,
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  const owners = new Map<string, string[]>()
  for (const service of services) {
    for (const routine of service.manifest.owned_dataset?.private_routines ?? []) {
      const entries = owners.get(routine) ?? []
      entries.push(service.manifest.service_key)
      owners.set(routine, entries)
      if (inventory.has(routine)) continue
      findings.push({
        rule_version: 1,
        rule_id: "declared_routine_missing",
        subject: `routine:${routine}`,
        evidence: { routine, service_key: service.manifest.service_key },
        summary: `${service.manifest.service_key} declares absent routine ${routine}.`,
      })
    }
  }
  for (const routine of inventory) {
    const declared = owners.get(routine) ?? []
    if (declared.length === 1) continue
    findings.push({
      rule_version: 1,
      rule_id: declared.length === 0 ? "routine_owner_missing" : "routine_owner_ambiguous",
      subject: `routine:${routine}`,
      evidence: { owner_services: declared.sort().join(","), routine },
      summary: declared.length === 0
        ? `${routine} has no owning service.`
        : `${routine} has multiple owning services: ${declared.sort().join(", ")}.`,
    })
  }
  return findings
}
