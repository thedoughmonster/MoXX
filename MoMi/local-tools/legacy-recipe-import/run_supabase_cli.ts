import { spawnSync } from "node:child_process"

import { resolveSupabaseCli } from "./resolve_supabase_cli.ts"

export async function runSupabaseCli(
  args: string[],
  workspaceRoot: string,
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  const cli = await resolveSupabaseCli(workspaceRoot)
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: workspaceRoot, env: environment, encoding: "utf8", windowsHide: true,
    timeout: 300_000, maxBuffer: 1024 * 1024,
  })
  if (result.error) throw new Error(`Supabase CLI could not complete: ${result.error.message}`)
  if (result.status !== 0) throw new Error("Supabase CLI rejected a sealed SQL statement")
  return String(result.stdout).trim()
}
