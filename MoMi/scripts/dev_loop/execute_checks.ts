import { mkdirSync, mkdtempSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { basename, join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { runCapturedCheck } from "./run_captured_check.ts"
import type { CheckExecutionBinding } from "./final_validation_types.ts"
import type { CheckCommand, CommandEvidence } from "./types.ts"

export function executeChecks(
  checks: CheckCommand[],
  binding: CheckExecutionBinding = {},
): CommandEvidence[] {
  for (const check of checks) {
    const advisory = check.advisory
    const advisoryKeys = Object.keys(advisory ?? {}).sort().join(",")
    const validAdvisory = check.enforcement === "advisory" &&
      ((check.id === "quality-report" &&
        advisoryKeys === "path,regenerate,rule" &&
        advisory?.rule === "quality-report-freshness" &&
        advisory.path === "docs/quality-metrics.json" &&
        advisory.regenerate === "pnpm quality:generate") ||
        (check.id === "source-quality-soft-limit" &&
          advisoryKeys === "path,remediate,rule" &&
          advisory?.rule === "source-quality-soft-limit" &&
          advisory.path === "." &&
          advisory.remediate ===
            "Refactor reported handwritten files to 120 lines or fewer"))
    if (
      !check.id || !check.command || !Array.isArray(check.args) ||
      check.args.some((item) => typeof item !== "string") ||
      (check.enforcement !== "hard_stop" && !validAdvisory) ||
      (check.enforcement === "hard_stop" && advisory !== undefined)
    ) throw new Error(`Invalid enforcement metadata for check ${check.id || "(missing)"}`)
  }
  const logRoot = join(workspaceRoot, ".momi", "logs")
  mkdirSync(logRoot, { recursive: true })
  const directory = mkdtempSync(join(logRoot, "run-"))
  const relativeDirectory = `.momi/logs/${basename(directory)}`
  return checks.map((check) => {
    binding.assert_invariants?.()
    const started = performance.now()
    const name = check.id.replaceAll(/[^a-z0-9-]/gi, "-")
    const stdoutPath = `${relativeDirectory}/${name}.stdout.log`
    const stderrPath = `${relativeDirectory}/${name}.stderr.log`
    const result = runCapturedCheck(
      check,
      join(workspaceRoot, stdoutPath),
      join(workspaceRoot, stderrPath),
      binding.environment,
    )
    binding.assert_invariants?.()
    return {
      id: check.id,
      enforcement: check.enforcement,
      ...(check.advisory ? { advisory: check.advisory } : {}),
      status: result.status,
      duration_ms: Math.round(performance.now() - started),
      stdout_path: stdoutPath,
      stderr_path: stderrPath,
      stdout_sha256: result.stdout_sha256,
      stderr_sha256: result.stderr_sha256,
    }
  })
}
