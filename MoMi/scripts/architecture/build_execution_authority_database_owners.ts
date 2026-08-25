import type {
  DatabaseOwnerIndex,
} from "./execution_authority_types.ts"
import type { LoadedService } from "./types.ts"

export function buildExecutionAuthorityDatabaseOwners(
  services: LoadedService[],
): DatabaseOwnerIndex {
  const owners: DatabaseOwnerIndex = {
    relations: {}, routines: {}, schemas: {},
  }
  const add = (
    kind: keyof DatabaseOwnerIndex,
    object: string,
    service: string,
  ) => {
    const values = owners[kind][object] ?? []
    owners[kind][object] = [...new Set([...values, service])].sort()
  }
  for (const { manifest } of services) {
    const dataset = manifest.owned_dataset
    if (!dataset) continue
    for (const schema of [
      ...(dataset.private_schema ? [dataset.private_schema] : []),
      ...(dataset.private_schemas ?? []),
    ]) add("schemas", schema, manifest.service_key)
    for (const relation of dataset.private_relations) {
      add("relations", relation, manifest.service_key)
    }
    for (const routine of dataset.private_routines ?? []) {
      add("routines", routine, manifest.service_key)
    }
  }
  return owners
}
