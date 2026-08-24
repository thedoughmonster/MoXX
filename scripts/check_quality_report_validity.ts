import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { generatedArtifactDiagnostic } from
  "./diagnostics/generated_artifact_diagnostic.ts"
import { isCanonicalArtifactRepairSafe } from
  "./diagnostics/is_canonical_artifact_repair_safe.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { parseQualityReport } from "./quality/parse_quality_report.ts"

const path = join(workspaceRoot, "docs", "quality-metrics.json")
try {
  parseQualityReport(await readFile(path, "utf8"))
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  throw new Error(renderRepositoryDiagnostics([
    generatedArtifactDiagnostic(
      "quality", "validity", "hard_stop", detail,
      isCanonicalArtifactRepairSafe(error),
    ),
  ]).trimEnd())
}
console.log("Quality trend report structure is valid.")
