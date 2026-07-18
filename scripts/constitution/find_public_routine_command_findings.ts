import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findPublicRoutineCommandFindings(
  services: LoadedService[],
  routineInventory?: Set<string>,
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  for (const service of services) {
    const key = service.manifest.service_key
    const dataset = service.manifest.owned_dataset
    const artifactGroups = [
      ["read", dataset?.public_routine_reads ?? [], dataset?.public_reads ?? []],
      ["command", dataset?.public_routine_commands ?? [], dataset?.public_commands ?? []],
    ] as const
    for (const [kind, artifacts, contracts] of artifactGroups) {
      for (const artifact of artifacts) {
        if (!contracts.includes(artifact.contract)) {
          findings.push({
            rule_version: 1,
            rule_id: `public_routine_${kind}_contract_missing`,
            subject: `contract:${artifact.contract}`,
            evidence: {
              contract: artifact.contract,
              routine: artifact.routine,
              service_key: key,
            },
            summary: `${key} maps ${artifact.routine} to an undeclared ${kind}.`,
          })
        }
        if (!dataset?.private_routines?.includes(artifact.routine)) findings.push({
          rule_version: 1,
          rule_id: `public_routine_${kind}_not_owned`,
          subject: `routine:${artifact.routine}`,
          evidence: {
            contract: artifact.contract,
            routine: artifact.routine,
            service_key: key,
          },
          summary: `${key} exposes ${artifact.routine} without owning that routine.`,
        })
        if (routineInventory && !routineInventory.has(artifact.routine)) findings.push({
          rule_version: 1,
          rule_id: `public_routine_${kind}_missing`,
          subject: `routine:${artifact.routine}`,
          evidence: { routine: artifact.routine, service_key: key },
          summary: `${key} exposes absent routine ${artifact.routine}.`,
        })
      }
    }
  }
  return findings
}
