import { mkdirSync, writeFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { workspaceRoot } from "../architecture/paths.ts"
import type { CheckCommand, CommandEvidence } from "./types.ts"

export function executeChecks(checks: CheckCommand[]): CommandEvidence[] {
  for (const check of checks) {
    const advisory = check.advisory
    const validAdvisory = check.enforcement === "advisory" &&
      advisory?.rule === "quality-report-freshness" &&
      advisory.path === "docs/quality-metrics.json" &&
      advisory.regenerate === "pnpm quality:generate"
    if (
      !check.id || !check.command || !Array.isArray(check.args) ||
      check.args.some((item) => typeof item !== "string") ||
      (check.enforcement !== "hard_stop" && !validAdvisory) ||
      (check.enforcement === "hard_stop" && advisory !== undefined)
    ) throw new Error(`Invalid enforcement metadata for check ${check.id || "(missing)"}`)
  }
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
      enforcement: check.enforcement,
      ...(check.advisory ? { advisory: check.advisory } : {}),
      status: result.status ?? 1,
      duration_ms: duration,
      stdout_path: stdoutPath,
      stderr_path: stderrPath,
      stdout,
      stderr,
    }
  })
}
