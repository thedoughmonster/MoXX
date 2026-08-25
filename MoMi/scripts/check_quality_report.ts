import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { collectQualityMetrics } from "./quality/collect_quality_metrics.ts"
import { renderQualityReport } from "./quality/render_quality_report.ts"

const path = join(workspaceRoot, "docs", "quality-metrics.json")
const expected = renderQualityReport(await collectQualityMetrics())
const actual = await readFile(path, "utf8")
if (actual.replaceAll("\r\n", "\n") !== expected) {
  throw new Error(
    `Quality report is stale; run npm run quality:generate\nExpected:\n${expected}\nActual:\n${actual}`,
  )
}
console.log("Quality trend report is current.")
