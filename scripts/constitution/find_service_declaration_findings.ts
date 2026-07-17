import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFindingInput } from "./types.ts"

const ownedUnitKinds = new Set([
  "database_processor", "cron_job", "queue", "event_subscription",
])
const dependencyKinds = new Set(["postgres_extension", "vault_secret"])

export function findServiceDeclarationFindings(
  services: LoadedService[],
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  for (const service of services) {
    const manifest = service.manifest
    const key = manifest.service_key
    const subject = `services/${key}/service.json`
    const type = manifest.service_type
    const dataset = manifest.owned_dataset
    if (!type) {
      findings.push({
        rule_version: 1,
        rule_id: "service_type_missing",
        subject,
        evidence: { service_key: key },
        summary: "Service manifest does not declare service_type.",
      })
    }
    if (type === "dataset_owner" && !dataset) {
      findings.push({
        rule_version: 1,
        rule_id: "dataset_owner_missing_dataset",
        subject,
        evidence: { service_key: key, service_type: type },
        summary: "Dataset-owner service does not declare owned_dataset.",
      })
    }
    if (dataset && !type) {
      findings.push({
        rule_version: 1,
        rule_id: "owned_dataset_type_conflict",
        subject,
        evidence: {
          dataset_key: dataset.dataset_key,
          service_key: key,
          service_type: "undeclared",
        },
        summary: "A service must declare service_type before owned_dataset.",
      })
    }
    if (type) {
      const expectedKind = type === "procurement_adapter"
        ? "source_adapter"
        : type === "destination_adapter" ? "destination_adapter" : "core_capability"
      if (manifest.kind !== expectedKind) {
        findings.push({
          rule_version: 1,
          rule_id: "service_kind_type_conflict",
          subject,
          evidence: { kind: manifest.kind, service_key: key, service_type: type },
          summary: `${type} requires kind ${expectedKind}.`,
        })
      }
    }
    const datasetContracts = [
      ...(dataset?.public_reads ?? []).map((contract) => ({
        contract,
        contractKind: "public_read",
      })),
      ...(dataset?.public_commands ?? []).map((contract) => ({
        contract,
        contractKind: "public_command",
      })),
    ]
    for (const { contract, contractKind } of datasetContracts) {
      if (manifest.contracts.provides.includes(contract)) continue
      findings.push({
        rule_version: 1,
        rule_id: "dataset_contract_not_provided",
        subject: `contract:${contract}`,
        evidence: { contract, contract_kind: contractKind, service_key: key },
        summary: `${key} does not provide its dataset contract ${contract}.`,
      })
    }
    for (const unit of manifest.deployment?.owns ?? []) {
      if (ownedUnitKinds.has(unit.kind)) continue
      findings.push({
        rule_version: 1,
        rule_id: "deployment_owned_kind_invalid",
        subject,
        evidence: { service_key: key, unit_kind: unit.kind, unit_key: unit.key },
        summary: `${key} cannot own infrastructure dependency ${unit.kind}.`,
      })
    }
    for (const unit of manifest.deployment?.depends_on ?? []) {
      if (dependencyKinds.has(unit.kind)) continue
      findings.push({
        rule_version: 1,
        rule_id: "deployment_dependency_kind_invalid",
        subject,
        evidence: { service_key: key, unit_kind: unit.kind, unit_key: unit.key },
        summary: `${key} must own rather than depend on ${unit.kind}.`,
      })
    }
  }
  return findings
}
