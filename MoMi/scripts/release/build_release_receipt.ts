import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { BoundPlan, ValidationReceipt } from "../dev_loop/types.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import type { ReleaseReceipt } from "./types.ts"

export function buildReleaseReceipt(
  environment: EnvironmentKey,
  plan: BoundPlan,
  validation: ValidationReceipt,
  validationReceiptSha256: string,
  databaseApplied: boolean,
  deploymentRunId?: number,
): ReleaseReceipt {
  return {
    schema_version: 1,
    kind: "release",
    environment,
    base_sha: plan.base.sha,
    head_sha: plan.head.sha,
    head_tree: plan.head.tree,
    diff_sha256: plan.diff_sha256,
    impact_sha256: plan.impact_sha256,
    plan_sha256: hashText(canonicalJson(plan)),
    validation_receipt_sha256: validationReceiptSha256,
    validation,
    plan,
    database: databaseApplied ? "preview_apply_parity_complete" : "none",
    services: plan.impact.release.services,
    functions: plan.impact.release.functions,
    ...(deploymentRunId ? { deployment_run_id: deploymentRunId } : {}),
  }
}
