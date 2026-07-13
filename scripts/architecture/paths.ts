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
