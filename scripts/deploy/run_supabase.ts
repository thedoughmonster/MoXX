import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { buildSupabaseArgs } from "./build_supabase_args.ts"

export function runSupabase(
  args: string[],
  capture = false,
): string {
  const launcher = join(workspaceRoot, "node_modules", "supabase", "dist", "supabase.js")
  const result = spawnSync(process.execPath, [launcher, ...buildSupabaseArgs(args)], {
    cwd: workspaceRoot,
    encoding: capture ? "utf8" : undefined,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  })
  if (result.status !== 0) {
    throw new Error(`Supabase CLI failed with status ${result.status ?? "unknown"}`)
  }
  return capture ? String(result.stdout ?? "") : ""
}
