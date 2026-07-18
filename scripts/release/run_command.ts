import { spawnSync } from "node:child_process"

import { workspaceRoot } from "../architecture/paths.ts"
import type { CommandOptions, CommandResult } from "./types.ts"

export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): CommandResult {
  const capture = options.capture ?? false
  const env = { ...process.env }
  delete env.SUPABASE_DB_PASSWORD
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  })
  if (result.error) throw result.error
  const status = result.status ?? 1
  const stdout = capture ? String(result.stdout ?? "") : ""
  const stderr = capture ? String(result.stderr ?? "") : ""
  if (status !== 0 && !options.allowFailure) {
    const detail = stderr.trim() || stdout.trim() || `status ${status}`
    throw new Error(`${command} failed: ${detail}`)
  }
  return { status, stdout, stderr }
}
