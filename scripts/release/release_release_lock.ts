import { rmSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"

export function releaseReleaseLock(): void {
  rmSync(join(workspaceRoot, ".momi", "release.lock"), { force: true })
}
