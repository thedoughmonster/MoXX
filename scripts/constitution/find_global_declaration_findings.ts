import type { LoadedService } from "../architecture/types.ts"
import { findDuplicateDeclarations } from "./find_duplicate_declarations.ts"
import type {
  ConstitutionDeclaration,
  ConstitutionFindingInput,
} from "./types.ts"

export function findGlobalDeclarationFindings(
  services: LoadedService[],
): ConstitutionFindingInput[] {
  const datasets: ConstitutionDeclaration[] = []
  const roles: ConstitutionDeclaration[] = []
  const schemas: ConstitutionDeclaration[] = []
  const relations: ConstitutionDeclaration[] = []
  const contracts: ConstitutionDeclaration[] = []
  const events: ConstitutionDeclaration[] = []
  for (const service of services) {
    const key = service.manifest.service_key
    const dataset = service.manifest.owned_dataset
    if (dataset) {
      datasets.push({ service_key: key, value: dataset.dataset_key })
      if (dataset.db_role) roles.push({ service_key: key, value: dataset.db_role })
      if (dataset.private_schema) {
        schemas.push({ service_key: key, value: dataset.private_schema })
      }
      for (const value of dataset.private_relations) {
        relations.push({ service_key: key, value })
      }
      for (const value of dataset.emitted_events ?? []) {
        events.push({ service_key: key, value })
      }
    }
    for (const value of service.manifest.contracts.provides) {
      contracts.push({ service_key: key, value })
    }
  }
  const findings = [
    ...findDuplicateDeclarations("dataset_key_duplicate", "dataset", "Dataset", datasets),
    ...findDuplicateDeclarations("db_role_duplicate", "db-role", "Database role", roles),
    ...findDuplicateDeclarations("private_schema_duplicate", "schema", "Private schema", schemas),
    ...findDuplicateDeclarations("private_relation_duplicate", "relation", "Private relation", relations),
    ...findDuplicateDeclarations("contract_provider_duplicate", "contract", "Contract", contracts),
    ...findDuplicateDeclarations("event_producer_duplicate", "event", "Event", events),
  ]
  const schemaOwners = new Map<string, Set<string>>()
  for (const declaration of schemas) {
    const owners = schemaOwners.get(declaration.value) ?? new Set<string>()
    owners.add(declaration.service_key)
    schemaOwners.set(declaration.value, owners)
  }
  for (const relation of relations) {
    const schema = relation.value.split(".", 1)[0]
    const foreignOwners = [...(schemaOwners.get(schema) ?? [])]
      .filter((owner) => owner !== relation.service_key).sort()
    if (foreignOwners.length === 0) continue
    findings.push({
      rule_version: 1,
      rule_id: "private_relation_schema_conflict",
      subject: `relation:${relation.value}`,
      evidence: {
        relation_owner: relation.service_key,
        schema_owners: foreignOwners.join(","),
      },
      summary: `${relation.service_key} claims a relation in ${schema}, owned by ${foreignOwners.join(", ")}.`,
    })
  }
  return findings
}
