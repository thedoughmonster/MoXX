import { join } from "node:path"

import { readJson } from "../architecture/read_json.ts"
import { validateJson } from "../architecture/validate_json.ts"
import type { PostWriteDiagnostic } from "./types.ts"
import { manifestDiagnostic } from "../diagnostics/manifest_diagnostic.ts"
import { RepositoryDiagnosticError } from
  "../diagnostics/repository_diagnostic_error.ts"

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
    const message = error instanceof Error ? error.message : String(error)
    const repositoryDiagnostic = error instanceof RepositoryDiagnosticError
      ? error.diagnostics[0]
      : manifestDiagnostic(path, schemaName, message)
    return {
      code: "MANIFEST_SCHEMA_INVALID",
      path,
      severity: "error",
      evidence: {
        message: message.slice(0, 500),
        schema: `schemas/${schemaName}`,
      },
      repair_class: "SEMANTIC_REPAIR",
      ...(repositoryDiagnostic
        ? { repository_diagnostic: repositoryDiagnostic }
        : {}),
    }
  }
}
