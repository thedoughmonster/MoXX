import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { generatedArtifactDiagnostic } from
  "./diagnostics/generated_artifact_diagnostic.ts"
import { isCanonicalArtifactRepairSafe } from
  "./diagnostics/is_canonical_artifact_repair_safe.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { collectQualityMetrics } from "./quality/collect_quality_metrics.ts"
import { isQualityReportCurrent } from "./quality/is_quality_report_current.ts"
import { renderQualityReport } from "./quality/render_quality_report.ts"

const path = join(workspaceRoot, "docs", "quality-metrics.json")
const expected = renderQualityReport(await collectQualityMetrics())
let actual: string
try {
  actual = await readFile(path, "utf8")
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  throw new Error(renderRepositoryDiagnostics([
    generatedArtifactDiagnostic(
      "quality", "validity", "advisory", detail,
      isCanonicalArtifactRepairSafe(error),
    ),
  ]).trimEnd())
}
if (!isQualityReportCurrent(actual, expected)) {
  console.warn(renderRepositoryDiagnostics([
    generatedArtifactDiagnostic("quality", "freshness", "advisory"),
  ]).trimEnd())
  await new Promise<void>((resolve) => process.stderr.write("", resolve))
  process.exit(1)
}
console.log("quality-report-freshness current: docs/quality-metrics.json")
