import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { supabaseEnvironment } from "./supabase_environment.ts"

export function runSupabase(args: string[], capture = false): string {
  const launcher = join(workspaceRoot, "node_modules", "supabase", "dist", "supabase.js")
  const result = spawnSync(process.execPath, [launcher, ...args], {
    cwd: workspaceRoot,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    env: supabaseEnvironment(),
  })
  if (result.status !== 0) {
    throw new Error(`Supabase CLI failed with status ${result.status ?? "unknown"}`)
  }
  return capture ? String(result.stdout) : ""
}
