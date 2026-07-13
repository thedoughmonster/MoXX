import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"

export function runChecks(service: string): void {
  const result = spawnSync(
    process.execPath,
    [join(workspaceRoot, "scripts", "check.ts"), "--service", service],
    { cwd: workspaceRoot, stdio: "inherit" },
  )
  if (result.status !== 0) throw new Error("Repository checks failed")
}
