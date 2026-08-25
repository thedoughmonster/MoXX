import { spawnSync } from "node:child_process"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { buildSupabaseArgs } from "./build_supabase_args.ts"
import { supabaseEnvironment } from "./supabase_environment.ts"

export function runSupabase(
  args: string[],
  capture: boolean | "combined" = false,
  launcher = join(workspaceRoot, "node_modules", "supabase", "dist", "supabase.js"),
): string {
  const capturesOutput = capture !== false
  const result = spawnSync(process.execPath, [launcher, ...buildSupabaseArgs(args)], {
    cwd: workspaceRoot,
    encoding: capturesOutput ? "utf8" : undefined,
    env: supabaseEnvironment(process.env),
    stdio: capturesOutput ? ["ignore", "pipe", "pipe"] : "inherit",
  })
  if (result.error) throw result.error
  const stdout = capturesOutput ? String(result.stdout ?? "") : ""
  const stderr = capturesOutput ? String(result.stderr ?? "") : ""
  if (result.status !== 0) {
    const detail = stderr.trim() || stdout.trim()
    throw new Error(
      `Supabase CLI failed with status ${result.status ?? "unknown"}` +
      `${detail ? `: ${detail}` : ""}`,
    )
  }
  return capture === "combined" ? `${stdout}\n${stderr}` : stdout
}
