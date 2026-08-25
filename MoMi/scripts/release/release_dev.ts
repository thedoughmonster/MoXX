import { readFileSync } from "node:fs"

import { buildBoundPlan } from "../dev_loop/build_bound_plan.ts"
import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import { applyMigrations } from "./apply_migrations.ts"
import { assertPlanMatchesValidation } from "./assert_plan_matches_validation.ts"
import { assertReleaseHead } from "./assert_release_head.ts"
import { assertValidationPlanDigest } from "./assert_validation_plan_digest.ts"
import { assertValidationJob } from "./assert_validation_job.ts"
import { buildReleaseReceipt } from "./build_release_receipt.ts"
import { ensureDispatchedWorkflow } from "./ensure_dispatched_workflow.ts"
import { readValidationReceipt } from "./read_validation_receipt.ts"
import { writeReleaseReceipt } from "./write_release_receipt.ts"

export async function releaseDev(validationPath: string): Promise<void> {
  const head = assertReleaseHead("dev")
  const source = readFileSync(validationPath, "utf8")
  const validation = readValidationReceipt(validationPath)
  assertValidationJob(validation)
  const validatedPlan = await buildBoundPlan(
    validation.identities.base_sha!,
    validation.identities.head_sha!,
  )
  assertPlanMatchesValidation(validatedPlan, validation)
  assertValidationPlanDigest(validatedPlan, validation)
  const plan = await buildBoundPlan(validation.identities.base_sha!, head)
  assertPlanMatchesValidation(plan, validation)
  const databaseApplied = plan.impact.release.database !== "none"
  if (databaseApplied) {
    await applyMigrations("dev", validatedPlan.impact.migrations)
  }
  const planDigest = hashText(canonicalJson(plan))
  const run = plan.impact.release.functions.length === 0
    ? undefined
    : await ensureDispatchedWorkflow("deploy-dev.yml", "dev", head, "deploy", {
      expected_sha: head,
      base_sha: plan.base.sha,
      services: plan.impact.release.services.join(","),
      plan_sha256: planDigest,
      validated_tree: plan.head.tree,
    })
  const receipt = buildReleaseReceipt(
    "dev",
    plan,
    validation,
    hashText(source),
    databaseApplied,
    run?.databaseId,
  )
  const path = writeReleaseReceipt(receipt)
  console.log(`Development release receipt: ${path}`)
}
