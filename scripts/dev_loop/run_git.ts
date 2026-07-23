import { spawnSync } from "node:child_process"

import { workspaceRoot } from "../architecture/paths.ts"

export function runGit(args: string[], trim = true): string {
  const env = { ...process.env }
  delete env.SUPABASE_DB_PASSWORD
  delete env.PGPASSWORD
  const result = spawnSync("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env,
  })
  if (result.status !== 0) {
    throw result.error ?? new Error(String(result.stderr || "git failed"))
  }
  const output = String(result.stdout)
  return trim ? output.trim() : output.trimEnd()
}
