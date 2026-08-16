import { readFile } from "node:fs/promises"
import { extname, join } from "node:path"

import { readJson } from "../architecture/read_json.ts"
import { inspectSourceQualityFile } from "../inspect_source_quality_file.ts"
import type { SourceQualityPolicies } from "../source_quality_types.ts"
import type { PostWriteDiagnostic } from "./types.ts"
import { validateChangedManifest } from "./validate_changed_manifest.ts"

export async function inspectChangedFile(
  root: string,
  path: string,
  policies: SourceQualityPolicies,
): Promise<PostWriteDiagnostic[]> {
  const absolute = join(root, path)
  let source: string
  try {
    source = await readFile(absolute, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const diagnostics: PostWriteDiagnostic[] = inspectSourceQualityFile(
    path,
    source,
    policies,
  ).map((diagnostic) => ({
    code: diagnostic.code,
    path: diagnostic.path,
    severity: diagnostic.severity,
    evidence: {
      actual: diagnostic.actual,
      column: diagnostic.column,
      limit: diagnostic.limit,
      line: diagnostic.line,
      message: diagnostic.message,
    },
    repair_class: diagnostic.repair_class,
  }))
  if (extname(path) !== ".json") return diagnostics
  let value: unknown
  try {
    value = await readJson<unknown>(absolute)
  } catch (error) {
    diagnostics.push({
      code: "JSON_PARSE_FAILURE",
      path,
      severity: "error",
      evidence: {
        message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      },
      repair_class: "SEMANTIC_REPAIR",
    })
    return diagnostics
  }
  const manifest = await validateChangedManifest(root, path, value)
  if (manifest !== null) diagnostics.push(manifest)
  return diagnostics
}
