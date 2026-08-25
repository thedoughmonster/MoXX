import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFinding } from "../constitution/types.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function constitutionDiagnostic(
  finding: ConstitutionFinding,
  services: LoadedService[],
): RepositoryDiagnosticV1 | null {
  const evidence = finding.evidence
  const contract = evidence.contract
  let ownerKey = evidence.owner_service
  let contracts: string[] = []
  if (finding.rule_id === "dataset_contract_not_provided" &&
    evidence.service_key && contract) {
    ownerKey = evidence.service_key
    contracts = [contract]
  } else if (finding.rule_id === "direct_private_relation_access" &&
    evidence.access === "read" && ownerKey && evidence.relation) {
    const owners = services.filter((item) =>
      item.manifest.owned_dataset?.private_relations.includes(evidence.relation!),
    )
    if (owners.length !== 1 || owners[0].manifest.service_key !== ownerKey) return null
    const dataset = owners[0].manifest.owned_dataset
    contracts = (dataset?.public_relation_reads ?? [])
      .filter((item) => item.relation === evidence.relation)
      .map((item) => item.contract)
  } else if (finding.rule_id === "direct_private_routine_call" &&
    ownerKey && evidence.routine) {
    const owners = services.filter((item) =>
      item.manifest.owned_dataset?.private_routines.includes(evidence.routine!),
    )
    if (owners.length !== 1 || owners[0].manifest.service_key !== ownerKey) return null
    const dataset = owners[0].manifest.owned_dataset
    contracts = (dataset?.public_routine_reads ?? [])
      .filter((item) => item.routine === evidence.routine)
      .map((item) => item.contract)
  }
  const uniqueContracts = [...new Set(contracts)].sort()
  if (!ownerKey || uniqueContracts.length !== 1) return null
  const owner = services.find((item) => item.manifest.service_key === ownerKey)
  if (!owner) return null
  if (finding.rule_id !== "dataset_contract_not_provided" &&
    !owner.manifest.contracts.provides.includes(uniqueContracts[0])) return null
  const consumer = evidence.consumer_service ?? evidence.service_key
  const expected = finding.rule_id === "dataset_contract_not_provided"
    ? `Declare ${uniqueContracts.join(", ")} in services/${ownerKey}/service.json contracts.provides.`
    : `Consume ${ownerKey}'s ${uniqueContracts.join(", ")} public contract` +
      `${consumer ? ` from services/${consumer}/service.json` : ""} using the public ` +
      `artifact declared by services/${ownerKey}/service.json.`
  if (expected.length > 500) return null
  const location = finding.rule_id === "dataset_contract_not_provided"
    ? { path: `services/${ownerKey}/service.json` }
    : /^(database|services)\//u.test(finding.subject)
    ? { path: finding.subject }
    : undefined
  return {
    schema_version: 1,
    rule_id: finding.rule_id,
    enforcement: "hard_stop",
    ...(location ? { location } : {}),
    violated_rule: finding.rule_id === "dataset_contract_not_provided"
      ? "An owned dataset contract must be provided by its authoritative service manifest."
      : "A service may access another owner's data only through an exact declared public contract.",
    expected,
    repair: { kind: "none" },
    validation_command: "pnpm constitution:check",
    fingerprint: {
      group: {
        rule_id: finding.rule_id,
        owner_service: owner.manifest.service_key,
        contract: uniqueContracts.join(","),
      },
      instance: { subject: finding.subject, finding: finding.fingerprint },
    },
  }
}
