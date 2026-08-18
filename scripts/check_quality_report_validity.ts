import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { parseQualityReport } from "./quality/parse_quality_report.ts"

const path = join(workspaceRoot, "docs", "quality-metrics.json")
parseQualityReport(await readFile(path, "utf8"))
console.log("Quality trend report structure is valid.")
