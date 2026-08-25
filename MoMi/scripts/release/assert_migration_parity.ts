import { readdirSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { assertMigrationVersionParity } from "./assert_migration_version_parity.ts"
import { parseMigrationQuery } from "./parse_migration_query.ts"

export function assertMigrationParity(linkedList: string): void {
  const directory = join(workspaceRoot, "supabase", "migrations")
  const local = readdirSync(directory)
    .map((file) => file.match(/^(\d{14})_.+\.sql$/)?.[1] ?? null)
    .filter((version): version is string => version !== null)
    .sort()
  const remote = parseMigrationQuery(linkedList).sort()
  assertMigrationVersionParity(local, remote)
}
