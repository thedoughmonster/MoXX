import { appendFileSync, closeSync, openSync } from "node:fs"
import { spawnSync } from "node:child_process"

import { workspaceRoot } from "../architecture/paths.ts"
import { hashFile } from "./hash_file.ts"
import type { CheckCommand } from "./types.ts"

export function runCapturedCheck(
  check: CheckCommand,
  stdoutPath: string,
  stderrPath: string,
  environment: NodeJS.ProcessEnv = {},
): { status: number; stdout_sha256: string; stderr_sha256: string } {
  const stdoutDescriptor = openSync(stdoutPath, "w")
  const stderrDescriptor = openSync(stderrPath, "w")
  let result
  try {
    result = spawnSync(check.command, check.args, {
      cwd: workspaceRoot,
      stdio: ["ignore", stdoutDescriptor, stderrDescriptor],
      env: {
        ...process.env,
        ...environment,
        SUPABASE_DB_PASSWORD: undefined,
        PGPASSWORD: undefined,
      },
    })
  } finally {
    closeSync(stdoutDescriptor)
    closeSync(stderrDescriptor)
  }
  if (!result) throw new Error(`Check ${check.id} did not start`)
  if (result.error) appendFileSync(stderrPath, `${result.error.message}\n`)
  return {
    status: result.status ?? 1,
    stdout_sha256: hashFile(stdoutPath),
    stderr_sha256: hashFile(stderrPath),
  }
}
