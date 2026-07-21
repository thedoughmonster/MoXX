import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { migrationDatabaseUrl } from "./migration_database_url.ts"

export function assertLinkedSupabaseTarget(
  projectRef: string,
  linkedRef = readFileSync(
    join(workspaceRoot, "supabase", ".temp", "project-ref"),
    "utf8",
  ).trim(),
  poolerUrl = readFileSync(
    join(workspaceRoot, "supabase", ".temp", "pooler-url"),
    "utf8",
  ).trim(),
): string {
  if (linkedRef !== projectRef) {
    throw new Error(`Supabase CLI linked unexpected project ${linkedRef || "(empty)"}`)
  }
  migrationDatabaseUrl(poolerUrl, projectRef)
  return poolerUrl
}
