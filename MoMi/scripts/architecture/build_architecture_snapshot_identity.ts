import { join } from "node:path"

import { digestArchitectureSnapshotIdentity } from
  "./digest_architecture_snapshot_identity.ts"
import { inspectArchitectureSnapshotSource } from
  "./inspect_architecture_snapshot_source.ts"
import { readJson } from "./read_json.ts"
import { validateJson } from "./validate_json.ts"
import { workspaceRoot } from "./paths.ts"
import {
  architectureSnapshotIdentitySchemaId,
  ArchitectureSnapshotSourceError,
  type ArchitectureSnapshot,
  type ArchitectureSnapshotIdentity,
} from "./architecture_snapshot_identity_types.ts"

export async function buildArchitectureSnapshotIdentity(
  root = workspaceRoot,
): Promise<ArchitectureSnapshot> {
  const source = await inspectArchitectureSnapshotSource(root)
  if (source.diagnostics.length > 0) {
    throw new ArchitectureSnapshotSourceError(source.diagnostics)
  }
  const identity: ArchitectureSnapshotIdentity = {
    $schema: architectureSnapshotIdentitySchemaId,
    schema_version: 1,
    repository: "thedoughmonster/momi-backend",
    branch: "dev",
    commit: source.commit,
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
  const schema = await readJson<object>(join(
    root, "schemas", "architecture-snapshot-identity-v1.schema.json",
  ))
  validateJson(schema, identity, "architecture snapshot identity")
  return { identity, digest: digestArchitectureSnapshotIdentity(identity) }
}
