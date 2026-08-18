import { fileURLToPath } from "node:url"
import { join } from "node:path"

export const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url))
export const workspaceConfigPath = join(workspaceRoot, "workspace.json")
export const workspaceSchemaPath = join(
  workspaceRoot,
  "schemas",
  "workspace-v1.schema.json",
)
export const serviceSchemaPath = join(
  workspaceRoot,
  "schemas",
  "service-manifest-v1.schema.json",
)
export const functionSchemaPath = join(
  workspaceRoot,
  "schemas",
  "function-manifest-v1.schema.json",
)
export const architectureSnapshotIdentitySchemaPath = join(
  workspaceRoot,
  "schemas",
  "architecture-snapshot-identity-v1.schema.json",
)
export const serviceDependencyGraphSchemaPath = join(
  workspaceRoot,
  "schemas",
  "service-dependency-graph-v1.schema.json",
)
export const serviceDependencyGraphOutputPath = join(
  workspaceRoot,
  ".momi",
  "architecture",
  "service-dependency-graph-v1.json",
)
export const retirementSchemaPath = join(
  workspaceRoot,
  "schemas",
  "retirement-manifest-v1.schema.json",
)
