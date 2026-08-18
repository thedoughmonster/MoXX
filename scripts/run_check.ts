import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"

const hard = spawnSync(
  process.execPath,
  [join(workspaceRoot, "scripts", "check.ts"), ...process.argv.slice(2)],
  { stdio: "inherit" },
)
if (hard.status !== 0) process.exit(hard.status ?? 1)

const advisory = spawnSync(
  process.execPath,
  [join(workspaceRoot, "scripts", "check_quality_report.ts")],
  { stdio: "inherit" },
)
if (advisory.status !== 0) {
  console.warn("Hard repository checks passed with a quality freshness advisory.")
}
process.exit(0)
