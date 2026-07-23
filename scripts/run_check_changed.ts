import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { buildBoundPlan } from "./dev_loop/build_bound_plan.ts"
import { buildCompactReceipt } from "./dev_loop/build_compact_receipt.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { executeChecks } from "./dev_loop/execute_checks.ts"
import { hashText } from "./dev_loop/hash_text.ts"
import { readOption } from "./read_option.ts"

if (process.argv[2] !== "changed") throw new Error("Usage: momi-check changed")
const base = readOption("base", "origin/dev")
const head = readOption("head", "HEAD")
const output = readOption("receipt", ".momi/validation-receipt.json")
const plan = await buildBoundPlan(base, head)
const final = process.argv.includes("--final")
const checks = final ? plan.impact.final_gate.checks : plan.impact.iteration_checks
const evidence = executeChecks(checks)
const compact = buildCompactReceipt({
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
  commands: evidence,
})
const receipt = {
  ...compact,
  kind: "validation",
  gate: final ? plan.impact.final_gate.kind : "focused",
  required_job: final ? "validate-final" : "local-focused",
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${canonicalJson(receipt)}\n`)
process.stdout.write(`${canonicalJson(receipt)}\n`)
if (evidence.some((item) => item.status !== 0)) process.exit(1)
