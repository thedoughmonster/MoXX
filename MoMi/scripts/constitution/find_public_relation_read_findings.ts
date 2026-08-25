import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFindingInput } from "./types.ts"

export function findPublicRelationReadFindings(
  services: LoadedService[],
  relationInventory?: Map<string, string>,
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  for (const service of services) {
    const key = service.manifest.service_key
    const dataset = service.manifest.owned_dataset
    for (const artifact of dataset?.public_relation_reads ?? []) {
      if (!dataset?.public_reads?.includes(artifact.contract)) {
        findings.push({
          rule_version: 1,
          rule_id: "public_relation_read_contract_missing",
          subject: `contract:${artifact.contract}`,
          evidence: {
            contract: artifact.contract,
            relation: artifact.relation,
            service_key: key,
          },
          summary: `${key} maps ${artifact.relation} to an undeclared public read.`,
        })
      }
      if (!dataset?.private_relations.includes(artifact.relation)) {
        findings.push({
          rule_version: 1,
          rule_id: "public_relation_read_not_owned",
          subject: `relation:${artifact.relation}`,
          evidence: {
            contract: artifact.contract,
            relation: artifact.relation,
            service_key: key,
          },
          summary: `${key} exposes ${artifact.relation} without owning it.`,
        })
      }
      if (
        !artifact.relation.match(/_v[1-9][0-9]*$/) ||
        (relationInventory && relationInventory.get(artifact.relation) !== "view")
      ) findings.push({
        rule_version: 1,
        rule_id: "public_relation_read_not_versioned_view",
        subject: `relation:${artifact.relation}`,
        evidence: {
          contract: artifact.contract,
          relation: artifact.relation,
          service_key: key,
        },
        summary: `${key} public relation read is not a migrated versioned view.`,
      })
    }
    const mapped = new Set([
      ...(dataset?.public_relation_reads ?? []).map((item) => item.contract),
      ...(dataset?.public_routine_reads ?? []).map((item) => item.contract),
    ])
    for (const contract of dataset?.public_reads ?? []) {
      if (mapped.has(contract)) continue
      findings.push({
        rule_version: 1,
        rule_id: "public_read_artifact_missing",
        subject: `contract:${contract}`,
        evidence: { contract, service_key: key },
        summary: `${key} public read ${contract} has no exact owned artifact.`,
      })
    }
  }
  return findings
}
