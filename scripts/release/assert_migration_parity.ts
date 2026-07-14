import { readdirSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { parseMigrationQuery } from "./parse_migration_query.ts"

export function assertMigrationParity(linkedList: string): void {
  const directory = join(workspaceRoot, "supabase", "migrations")
  const local = readdirSync(directory)
    .map((file) => file.match(/^(\d{14})_.+\.sql$/)?.[1] ?? null)
    .filter((version): version is string => version !== null)
    .sort()
  const remote = parseMigrationQuery(linkedList).sort()
  if (local.join("\n") !== remote.join("\n")) {
    const missing = local.filter((version) => !remote.includes(version))
    const extra = remote.filter((version) => !local.includes(version))
    throw new Error(
      `Migration history differs; missing remote: ${missing.join(", ") || "none"}; ` +
      `extra remote: ${extra.join(", ") || "none"}`,
    )
  }
}
