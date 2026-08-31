import { rmSync } from "node:fs"
import { appendFile } from "node:fs/promises"
import { join } from "node:path"

import { assertFinalValidationState } from
  "./dev_loop/assert_final_validation_state.ts"
import { buildBoundPlan } from "./dev_loop/build_bound_plan.ts"
import { buildBoundPlanFromCheckout } from
  "./dev_loop/build_bound_plan_from_checkout.ts"
import { captureFinalValidationState } from
  "./dev_loop/capture_final_validation_state.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { createFinalValidationCheckout } from
  "./dev_loop/create_final_validation_checkout.ts"
import { hashText } from "./dev_loop/hash_text.ts"
import { removeFinalValidationCheckout } from
  "./dev_loop/remove_final_validation_checkout.ts"
import { renderValidationSummary } from "./dev_loop/render_validation_summary.ts"
import { runValidation } from "./dev_loop/run_validation.ts"
import { setFinalValidationCheckoutWritable } from
  "./dev_loop/set_final_validation_checkout_writable.ts"
import type { FinalValidationState } from "./dev_loop/final_validation_types.ts"
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
let checkout: FinalValidationState | undefined
let source: FinalValidationState | undefined
let resultCode = 1
try {
  source = final ? captureFinalValidationState(base, head) : undefined
  const checkoutRoot = source
    ? join(source.repository_root, "..", ".momi-tmp",
      `${source.head.sha}-${process.pid}`)
    : undefined
  checkout = source && checkoutRoot
    ? createFinalValidationCheckout(source, checkoutRoot)
    : undefined
  const environment = source && checkout ? {
    MOMI_VALIDATION_MODE: "exact-committed-head",
    MOMI_VALIDATION_BASE_SHA: source.base.sha,
    MOMI_VALIDATION_HEAD_SHA: source.head.sha,
    MOMI_BASE_REF: source.base.sha,
    MOMI_HEAD_REF: source.head.sha,
    MOMI_DEV_REF: source.development.sha,
    MOMI_PROD_REF: source.production.sha,
    TMPDIR: join(checkout.workspace_root, ".momi", "tmp"),
  } : undefined
  if (checkout && environment) {
    setFinalValidationCheckoutWritable(checkout.repository_root, [
      join(checkout.workspace_root, ".momi"), environment.TMPDIR,
    ], false)
  }
  const plan = checkout && environment
    ? buildBoundPlanFromCheckout(
      checkout.workspace_root, source!.base.sha, source!.head.sha, environment,
    )
    : await buildBoundPlan(base, head, true)
  if (source) assertFinalValidationState(source)
  const checks = final ? plan.impact.final_gate.checks : plan.impact.iteration_checks
  const assertInvariants = source && checkout
    ? () => {
      assertFinalValidationState(source!)
      assertFinalValidationState(checkout!)
    }
    : undefined
  const compact = runValidation({
    kind: "validation", base_sha: plan.base.sha, head_sha: plan.head.sha,
    base_tree: plan.base.tree, head_tree: plan.head.tree,
    development_sha: source?.development.sha,
    development_tree: source?.development.tree,
    production_sha: source?.production.sha,
    production_tree: source?.production.tree,
    diff_sha256: plan.diff_sha256, impact_sha256: plan.impact_sha256,
    plan_sha256: hashText(canonicalJson(plan)),
    run_id: process.env.GITHUB_RUN_ID,
    log_url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY &&
        process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined,
    checks,
    receipt_path: output,
    execution_binding: checkout && environment ? {
      assert_invariants: assertInvariants,
      workspace_root: checkout.workspace_root,
      environment,
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
  resultCode = validationExitCode(compact)
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${final ? "Final" : "Focused"} validation STOP: ${detail}\n`)
} finally {
  if (source && checkout) {
    removeFinalValidationCheckout(source.repository_root, checkout.repository_root)
  }
}
process.exit(resultCode)
