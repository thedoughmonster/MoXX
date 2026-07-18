import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { buildSupabaseArgs } from "./build_supabase_args.ts"
import { supabaseEnvironment } from "./supabase_environment.ts"

export function runSupabase(
  args: string[],
  capture = false,
  databasePassword?: string,
  launcher = join(workspaceRoot, "node_modules", "supabase", "dist", "supabase.js"),
): string {
  const result = spawnSync(process.execPath, [launcher, ...buildSupabaseArgs(args)], {
    cwd: workspaceRoot,
    encoding: capture ? "utf8" : undefined,
    env: supabaseEnvironment(process.env, databasePassword),
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  })
  if (result.status !== 0) {
    throw new Error(`Supabase CLI failed with status ${result.status ?? "unknown"}`)
  }
  return capture ? String(result.stdout ?? "") : ""
}
