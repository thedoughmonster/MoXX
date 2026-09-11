import { spawnSync } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import { join } from "node:path"

import type { BoundPlan } from "./types.ts"

export function buildBoundPlanFromCheckout(
  workspaceRoot: string,
  baseSha: string,
  headSha: string,
  environment: NodeJS.ProcessEnv,
): BoundPlan {
  const output = join(workspaceRoot, ".momi", "final-impact-plan.json")
  rmSync(output, { force: true })
  const result = spawnSync(process.execPath, [
    "scripts/run_impact_plan.ts", "plan", "--base", baseSha,
    "--head", headSha, "--output", output, "--committed",
  ], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...environment,
      SUPABASE_DB_PASSWORD: undefined,
      PGPASSWORD: undefined,
    },
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.status !== 0) {
    const detail = String(result.stderr || result.error || "unknown error")
      .trim().slice(0, 500)
    throw new Error(`Unable to build the exact-HEAD plan in its checkout: ${detail}`)
  }
  const plan = JSON.parse(readFileSync(output, "utf8")) as BoundPlan
  if (plan.base.sha !== baseSha || plan.head.sha !== headSha) {
    throw new Error("Exact-HEAD checkout produced a mismatched validation plan")
  }
  return plan
}
