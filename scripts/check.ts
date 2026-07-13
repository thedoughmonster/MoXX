import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { readOption } from "./read_option.ts"

const service = readOption("service", "all")
const scripts = [
  "check_architecture.ts",
  "check_catalog.ts",
  "check_source_quality.ts",
  "check_edge_functions.ts",
]

for (const script of scripts) {
  const result = spawnSync(process.execPath, [join(workspaceRoot, "scripts", script)], {
    stdio: "inherit",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const tests = spawnSync(
  process.execPath,
  [join(workspaceRoot, "scripts", "run_tests.ts"), "--service", service],
  { stdio: "inherit" },
)
process.exit(tests.status ?? 1)
