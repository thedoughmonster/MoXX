import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFindingInput } from "./types.ts"

const datasetClasses = new Map([
  ["dataset_owner", new Set(["domain", "operational"])],
  ["raw_evidence_archive", new Set(["raw_evidence"])],
  ["event_router", new Set(["operational"])],
  ["procurement_adapter", new Set(["operational"])],
  ["transform", new Set(["operational"])],
  ["read_facade", new Set(["operational"])],
  ["destination_adapter", new Set(["operational"])],
])

export function findDatasetClassFindings(
  services: LoadedService[],
): ConstitutionFindingInput[] {
  const findings: ConstitutionFindingInput[] = []
  for (const service of services) {
    const { owned_dataset: dataset, service_key: key, service_type: type } =
      service.manifest
    const subject = `services/${key}/service.json`
    if (["dataset_owner", "raw_evidence_archive", "event_router"].includes(type ?? "") &&
      !dataset) findings.push({
        rule_version: 1,
        rule_id: "service_type_missing_dataset",
        subject,
        evidence: { service_key: key, service_type: type ?? "undeclared" },
        summary: `${type} service does not declare owned_dataset.`,
      })
    if (dataset && type && !datasetClasses.get(type)?.has(dataset.dataset_class)) {
      findings.push({
        rule_version: 1,
        rule_id: "dataset_class_type_conflict",
        subject,
        evidence: {
          dataset_class: dataset.dataset_class,
          dataset_key: dataset.dataset_key,
          service_key: key,
          service_type: type,
        },
        summary: `${type} cannot own a ${dataset.dataset_class} dataset.`,
      })
    }
    if (type === "procurement_adapter") {
      for (const dependency of service.manifest.contracts.consumes) findings.push({
        rule_version: 1,
        rule_id: "procurement_internal_contract_dependency",
        subject,
        evidence: {
          contract: dependency.contract,
          provider_service: dependency.service,
          service_key: key,
        },
        summary: `${key} procurement cannot call MoMi-owned contract ${dependency.contract}.`,
      })
    }
  }
  return findings
}
