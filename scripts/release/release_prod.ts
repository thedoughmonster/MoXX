import { readFileSync } from "node:fs"

import { buildBoundPlan } from "../dev_loop/build_bound_plan.ts"
import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import { applyMigrations } from "./apply_migrations.ts"
import { assertPlanMatchesValidation } from "./assert_plan_matches_validation.ts"
import { assertReleaseHead } from "./assert_release_head.ts"
import { buildReleaseReceipt } from "./build_release_receipt.ts"
import { ensurePromotionPullRequest } from "./ensure_promotion_pull_request.ts"
import { ensureDispatchedWorkflow } from "./ensure_dispatched_workflow.ts"
import { readReleaseReceipt } from "./read_release_receipt.ts"
import { runCommand } from "./run_command.ts"
import { writeReleaseReceipt } from "./write_release_receipt.ts"

export async function releaseProd(devReceiptPath: string): Promise<void> {
  const head = assertReleaseHead("prod")
  const devSource = readFileSync(devReceiptPath, "utf8")
  const devReceipt = readReleaseReceipt(devReceiptPath)
  if (devReceipt.head_sha !== head) {
    throw new Error("Production must consume the exact development release receipt")
  }
  const productionBefore = runCommand("git", ["rev-parse", "origin/prod"], {
    capture: true,
  }).stdout.trim()
  const plan = productionBefore === head
    ? devReceipt.plan
    : await buildBoundPlan(productionBefore, head)
  assertPlanMatchesValidation(plan, devReceipt.validation)
  if (plan.diff_sha256 !== devReceipt.diff_sha256) {
    throw new Error("Production diff differs from the development release")
  }
  const databaseApplied = plan.impact.release.database !== "none"
  if (databaseApplied) {
    await applyMigrations("prod", devReceipt.plan.impact.migrations)
  }
  if (plan.base.sha !== plan.head.sha) {
    ensurePromotionPullRequest(head, hashText(devSource))
    await ensureDispatchedWorkflow("promote-prod.yml", "dev", head, "promote", {
      expected_sha: head,
      dev_receipt_sha256: hashText(devSource),
    })
    runCommand("git", ["fetch", "origin", "prod:refs/remotes/origin/prod"])
  }
  const run = plan.impact.release.functions.length === 0
    ? undefined
    : await ensureDispatchedWorkflow("deploy-prod.yml", "prod", head, "deploy", {
      expected_sha: head,
      base_sha: plan.base.sha,
      services: plan.impact.release.services.join(","),
      plan_sha256: hashText(canonicalJson(plan)),
      validated_tree: plan.head.tree,
    })
  const receipt = buildReleaseReceipt(
    "prod", plan, devReceipt.validation, devReceipt.validation_receipt_sha256,
    databaseApplied, run?.databaseId,
  )
  console.log(`Production release receipt: ${writeReleaseReceipt(receipt)}`)
}
