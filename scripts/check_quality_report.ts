import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { collectQualityMetrics } from "./quality/collect_quality_metrics.ts"
import { isQualityReportCurrent } from "./quality/is_quality_report_current.ts"
import { renderQualityReport } from "./quality/render_quality_report.ts"

const path = join(workspaceRoot, "docs", "quality-metrics.json")
const expected = renderQualityReport(await collectQualityMetrics())
const actual = await readFile(path, "utf8")
if (!isQualityReportCurrent(actual, expected)) {
  console.warn([
    "Advisory: quality-report-freshness",
    "Path: docs/quality-metrics.json",
    "Status: stale",
    "Regenerate: pnpm quality:generate",
  ].join("\n"))
  process.exit(1)
}
console.log("quality-report-freshness current: docs/quality-metrics.json")
