import type { WorkspaceConfig } from "./types.ts"
import { readJson } from "./read_json.ts"
import { validateJson } from "./validate_json.ts"
import { workspaceConfigPath, workspaceSchemaPath } from "./paths.ts"

export async function loadWorkspace(): Promise<WorkspaceConfig> {
  const workspace = await readJson<WorkspaceConfig>(workspaceConfigPath)
  const schema = await readJson<object>(workspaceSchemaPath)
  validateJson(schema, workspace, "workspace.json")
  if (
    workspace.policies.hard_max_handwritten_lines <=
      workspace.policies.max_handwritten_lines
  ) {
    throw new Error("hard_max_handwritten_lines must exceed max_handwritten_lines")
  }
  return workspace
}
