import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"

export function readMigrationOwners(paths: string[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const path of paths.filter((item) => item.startsWith("supabase/migrations/"))) {
    const fullPath = join(workspaceRoot, path)
    if (!existsSync(fullPath)) continue
    const header = readFileSync(fullPath, "utf8").split(/\r?\n/, 1)[0] ?? ""
    const match = header.match(/^-- service-owner: ([a-z0-9]+(?:-[a-z0-9]+)*)$/)
    if (match?.[1]) owners.set(path, match[1])
  }
  return owners
}
