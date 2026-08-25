import { digestArchitectureSnapshotIdentity } from
  "../scripts/architecture/digest_architecture_snapshot_identity.ts"
import type { ArchitectureSnapshotIdentity } from
  "../scripts/architecture/architecture_snapshot_identity_types.ts"
import type { Architecture, LoadedService } from
  "../scripts/architecture/types.ts"

export type DependencyDefinition = {
  key: string
  provides: string[]
  consumes?: Array<{ service: string; contract: string }>
}

export const graphSnapshotIdentity: ArchitectureSnapshotIdentity = {
  $schema:
    "https://momi.local/schemas/architecture-snapshot-identity-v1.schema.json",
  schema_version: 1,
  repository: "thedoughmonster/momi-backend",
  branch: "dev",
  commit: "dcfd655b26f96bca94cfbc4a8180342e83c9a7fc",
  service_manifest_schema: {
    id: "https://momi.local/schemas/service-manifest-v1.schema.json",
    version: 1,
  },
  function_manifest_schema: {
    id: "https://momi.local/schemas/function-manifest-v1.schema.json",
    version: 1,
  },
  architecture_contract_version: 2,
}

export const graphSourceSnapshot = {
  identity: graphSnapshotIdentity,
  digest: digestArchitectureSnapshotIdentity(graphSnapshotIdentity),
}

export function createDependencyArchitecture(
  definitions: DependencyDefinition[],
): Pick<Architecture, "services"> {
  return {
    services: definitions.map((definition) => ({
      directory: `/repository/services/${definition.key}`,
      manifest: {
        service_key: definition.key,
        contracts: {
          provides: definition.provides,
          consumes: definition.consumes ?? [],
        },
      },
    }) as unknown as LoadedService),
  }
}
