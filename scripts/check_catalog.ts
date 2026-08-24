import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { generatedArtifactDiagnostic } from
  "./diagnostics/generated_artifact_diagnostic.ts"
import { isCanonicalArtifactRepairSafe } from
  "./diagnostics/is_canonical_artifact_repair_safe.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { renderFunctionCatalog } from "./function_catalog.ts"
import { validateArchitectureWithDiagnostics } from
  "./diagnostics/validate_architecture_with_diagnostics.ts"

const architecture = await validateArchitectureWithDiagnostics()
const expected = renderFunctionCatalog(
  architecture.functions,
  architecture.services,
)
let actual: string
try {
  actual = await readFile(join(workspaceRoot, "docs", "service-catalog.md"), "utf8")
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  throw new Error(renderRepositoryDiagnostics([
    generatedArtifactDiagnostic(
      "catalog", "validity", "hard_stop", detail,
      isCanonicalArtifactRepairSafe(error),
    ),
  ]).trimEnd())
}

if (actual !== expected) {
  throw new Error(renderRepositoryDiagnostics([
    generatedArtifactDiagnostic("catalog", "freshness", "hard_stop"),
  ]).trimEnd())
}

console.log("Service catalog is current.")
