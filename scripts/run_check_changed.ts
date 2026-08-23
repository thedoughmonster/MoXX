import { appendFile } from "node:fs/promises"

import { buildBoundPlan } from "./dev_loop/build_bound_plan.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { hashText } from "./dev_loop/hash_text.ts"
import { renderValidationSummary } from "./dev_loop/render_validation_summary.ts"
import { runValidation } from "./dev_loop/run_validation.ts"
import { validationExitCode } from "./dev_loop/validation_exit_code.ts"
import { readOption } from "./read_option.ts"

if (process.argv[2] !== "changed") throw new Error("Usage: momi-check changed")
const base = readOption("base", "origin/dev")
const head = readOption("head", "HEAD")
const output = readOption("receipt", ".momi/validation-receipt.json")
const plan = await buildBoundPlan(base, head)
const final = process.argv.includes("--final")
const checks = final ? plan.impact.final_gate.checks : plan.impact.iteration_checks
const compact = runValidation({
  kind: "validation",
  base_sha: plan.base.sha,
  head_sha: plan.head.sha,
  base_tree: plan.base.tree,
  head_tree: plan.head.tree,
  diff_sha256: plan.diff_sha256,
  impact_sha256: plan.impact_sha256,
  plan_sha256: hashText(canonicalJson(plan)),
  run_id: process.env.GITHUB_RUN_ID,
  log_url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined,
  checks,
  receipt_path: output,
  receipt_fields: {
    kind: "validation",
    gate: final ? plan.impact.final_gate.kind : "focused",
    required_job: final ? "validate-final" : "local-focused",
  },
})
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, renderValidationSummary(compact))
}
process.exit(validationExitCode(compact))
