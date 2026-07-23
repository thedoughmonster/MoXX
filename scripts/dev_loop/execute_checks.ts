import { mkdirSync, writeFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { workspaceRoot } from "../architecture/paths.ts"
import type { CheckCommand, CommandEvidence } from "./types.ts"

export function executeChecks(checks: CheckCommand[]): CommandEvidence[] {
  const directory = join(workspaceRoot, ".momi", "logs")
  mkdirSync(directory, { recursive: true })
  return checks.map((check) => {
    const started = performance.now()
    const result = spawnSync(check.command, check.args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        SUPABASE_DB_PASSWORD: undefined,
        PGPASSWORD: undefined,
      },
    })
    const duration = Math.round(performance.now() - started)
    const name = check.id.replaceAll(/[^a-z0-9-]/gi, "-")
    const stdoutPath = `.momi/logs/${name}.stdout.log`
    const stderrPath = `.momi/logs/${name}.stderr.log`
    const stdout = String(result.stdout ?? "")
    const stderr = String(result.stderr ?? result.error?.message ?? "")
    writeFileSync(join(workspaceRoot, stdoutPath), stdout)
    writeFileSync(join(workspaceRoot, stderrPath), stderr)
    return {
      id: check.id,
      status: result.status ?? 1,
      duration_ms: duration,
      stdout_path: stdoutPath,
      stderr_path: stderrPath,
      stdout,
      stderr,
    }
  })
}
