import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { EnvironmentKey } from "../deploy/types.ts"

export function acquireReleaseLock(environment: EnvironmentKey): void {
  const path = join(workspaceRoot, ".momi", "release.lock")
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path)) {
    let active = false
    try {
      const saved = JSON.parse(readFileSync(path, "utf8")) as { pid?: number }
      if (saved.pid) {
        try {
          process.kill(saved.pid, 0)
          active = true
        } catch {
          active = false
        }
      }
    } catch {
      active = false
    }
    if (active) throw new Error("Another MoMi release is already running")
    rmSync(path, { force: true })
  }
  writeFileSync(path, JSON.stringify({ pid: process.pid, environment }), { flag: "wx" })
}
