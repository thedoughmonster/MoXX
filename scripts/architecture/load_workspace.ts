import type { WorkspaceConfig } from "./types.ts"
import { readJson } from "./read_json.ts"
import { validateJson } from "./validate_json.ts"
import { workspaceConfigPath, workspaceSchemaPath } from "./paths.ts"

export async function loadWorkspace(): Promise<WorkspaceConfig> {
  const workspace = await readJson<WorkspaceConfig>(workspaceConfigPath)
  const schema = await readJson<object>(workspaceSchemaPath)
  validateJson(schema, workspace, "workspace.json")
  return workspace
}
