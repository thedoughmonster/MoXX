import { readFile } from "node:fs/promises"

import { SCHEMA_PATTERN, WORKSPACE_PATH } from "./constants.ts"
import type { WorkspaceConfig } from "./types.ts"

export async function loadWorkspace(): Promise<WorkspaceConfig> {
  const parsed: unknown = JSON.parse(await readFile(WORKSPACE_PATH, "utf8"))
  if (!parsed || typeof parsed !== "object") throw new Error("workspace.json is invalid")
  const value = parsed as Partial<WorkspaceConfig>
  if (value.schema_version !== 1 || !value.environments) {
    throw new Error("workspace.json has an unsupported structure")
  }
  for (const environment of ["dev", "prod"] as const) {
    const projectRef = value.environments[environment]?.project_ref
    if (typeof projectRef !== "string") {
      throw new Error(`workspace.json is missing ${environment} project_ref`)
    }
  }
  if (!Array.isArray(value.database_schemas) || value.database_schemas.length === 0) {
    throw new Error("workspace.json must provide application database_schemas")
  }
  const unique = new Set<string>()
  for (const schema of value.database_schemas) {
    if (typeof schema !== "string" || !SCHEMA_PATTERN.test(schema) || unique.has(schema)) {
      throw new Error("workspace.json database_schemas are invalid")
    }
    unique.add(schema)
  }
  return value as WorkspaceConfig
}
