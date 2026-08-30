import { spawn } from "node:child_process"
import type { Hash } from "node:crypto"

import { workspaceRoot } from "../architecture/paths.ts"

export async function hashGitDiff(
  hash: Hash,
  args: string[],
  cwd = workspaceRoot,
): Promise<void> {
  const env = { ...process.env }
  delete env.SUPABASE_DB_PASSWORD
  delete env.PGPASSWORD
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => hash.update(chunk))
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8192) {
        stderr += chunk.toString("utf8", 0, 8192 - stderr.length)
      }
    })
    child.once("error", reject)
    child.stdout.once("error", reject)
    child.once("close", (status, signal) => {
      if (status === 0) resolve()
      else reject(new Error(
        stderr.trim() || `git exited with ${status ?? `signal ${signal}`}`,
      ))
    })
  })
}
