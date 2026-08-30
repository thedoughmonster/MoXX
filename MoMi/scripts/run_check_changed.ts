import { rmSync } from "node:fs"
import { appendFile } from "node:fs/promises"
import { join } from "node:path"

import { assertFinalValidationState } from
  "./dev_loop/assert_final_validation_state.ts"
import { buildBoundPlan } from "./dev_loop/build_bound_plan.ts"
import { captureFinalValidationState } from
  "./dev_loop/capture_final_validation_state.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { hashText } from "./dev_loop/hash_text.ts"
import { renderValidationSummary } from "./dev_loop/render_validation_summary.ts"
import { runValidation } from "./dev_loop/run_validation.ts"
import { validationExitCode } from "./dev_loop/validation_exit_code.ts"
import { readOption } from "./read_option.ts"

if (process.argv[2] !== "changed") {
  throw new Error(
    "Usage: momi-check changed [--final] [--base <ref>] [--head <ref>] [--receipt <path>]",
  )
}
const base = readOption("base", "origin/dev")
const head = readOption("head", "HEAD")
const final = process.argv.includes("--final")
const output = readOption(
  "receipt",
  final ? ".momi/validation-receipt.json" : ".momi/focused-validation-receipt.json",
)
rmSync(output, { force: true })
try {
  const finalState = final ? captureFinalValidationState(base, head) : undefined
  const plan = await buildBoundPlan(
    finalState?.base.sha ?? base,
    finalState?.head.sha ?? head,
    !final,
  )
  if (finalState) assertFinalValidationState(finalState)
  const checks = final ? plan.impact.final_gate.checks : plan.impact.iteration_checks
  const assertInvariants = finalState
    ? () => assertFinalValidationState(finalState)
    : undefined
  const tempRoot = finalState
    ? join(finalState.repository_root, "..", ".momi-tmp",
      `${plan.head.sha}-${process.pid}`)
    : undefined
  const compact = runValidation({
    kind: "validation", base_sha: plan.base.sha, head_sha: plan.head.sha,
    base_tree: plan.base.tree, head_tree: plan.head.tree,
    diff_sha256: plan.diff_sha256, impact_sha256: plan.impact_sha256,
    plan_sha256: hashText(canonicalJson(plan)),
    run_id: process.env.GITHUB_RUN_ID,
    log_url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY &&
        process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined,
    checks,
    receipt_path: output,
    execution_binding: finalState && tempRoot ? {
      assert_invariants: assertInvariants,
      cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
      environment: {
        MOMI_VALIDATION_MODE: "exact-committed-head",
        MOMI_VALIDATION_BASE_SHA: plan.base.sha,
        MOMI_VALIDATION_HEAD_SHA: plan.head.sha,
        MOMI_BASE_REF: plan.base.sha,
        MOMI_HEAD_REF: plan.head.sha,
        MOMI_PROD_REF: finalState.production.sha,
        TMPDIR: tempRoot,
        MOMI_DEV_REF: /^[0-9a-f]{40}$/u.test(process.env.MOMI_DEV_REF ?? "")
          ? process.env.MOMI_DEV_REF
          : plan.base.sha,
      },
    } : undefined,
    summary_label: final ? "Exact-HEAD validation" : "Focused non-final validation",
    receipt_fields: {
      kind: "validation",
      gate: final ? plan.impact.final_gate.kind : "focused",
      required_job: final ? "validate-final" : "local-focused",
      evidence_scope: final ? "exact_committed_head" : "focused_worktree",
    },
  })
  if (final && process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, renderValidationSummary(compact))
  }
  process.exit(validationExitCode(compact))
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${final ? "Final" : "Focused"} validation STOP: ${detail}\n`)
  process.exit(1)
}
