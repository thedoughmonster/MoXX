import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { collectQualityMetrics } from "./quality/collect_quality_metrics.ts"
import { renderQualityReport } from "./quality/render_quality_report.ts"

const report = renderQualityReport(await collectQualityMetrics())
await writeFile(join(workspaceRoot, "docs", "quality-metrics.json"), report, "utf8")
console.log("Generated docs/quality-metrics.json")
