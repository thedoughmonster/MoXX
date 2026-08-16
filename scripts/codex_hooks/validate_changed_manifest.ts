import { join } from "node:path"

import { readJson } from "../architecture/read_json.ts"
import { validateJson } from "../architecture/validate_json.ts"
import type { PostWriteDiagnostic } from "./types.ts"

export async function validateChangedManifest(
  root: string,
  path: string,
  value: unknown,
): Promise<PostWriteDiagnostic | null> {
  let schemaName: string | null = null
  if (path === "workspace.json") schemaName = "workspace-v1.schema.json"
  if (/^services\/[^/]+\/service\.json$/.test(path)) {
    schemaName = "service-manifest-v1.schema.json"
  }
  if (/^services\/[^/]+\/functions\/[^/]+\/function\.json$/.test(path)) {
    schemaName = "function-manifest-v1.schema.json"
  }
  if (schemaName === null) return null
  const schema = await readJson<object>(join(root, "schemas", schemaName))
  try {
    validateJson(schema, value, path)
    return null
  } catch (error) {
    return {
      code: "MANIFEST_SCHEMA_INVALID",
      path,
      severity: "error",
      evidence: {
        message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        schema: `schemas/${schemaName}`,
      },
      repair_class: "SEMANTIC_REPAIR",
    }
  }
}
