import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { buildSupabaseArgs } from "./build_supabase_args.ts"
import { supabaseDatabaseEnvironment } from
  "./supabase_database_environment.ts"

export function runSupabaseDatabase(
  args: string[],
  capture = false,
  launcher = join(workspaceRoot, "node_modules", "supabase", "dist", "supabase.js"),
): string {
  const result = spawnSync(process.execPath, [launcher, ...buildSupabaseArgs(args)], {
    cwd: workspaceRoot,
    encoding: capture ? "utf8" : undefined,
    env: supabaseDatabaseEnvironment(process.env),
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Supabase database CLI failed with status ${result.status ?? "unknown"}`)
  }
  return capture ? String(result.stdout ?? "") : ""
}
