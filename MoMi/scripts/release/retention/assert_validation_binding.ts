import type { BoundPlan, ValidationReceipt } from "../../dev_loop/types.ts"
import type { RetentionApproval } from "./types.ts"

export function assertRetentionValidationBinding(
  approval: RetentionApproval, validation: ValidationReceipt, plan: BoundPlan, tree: string,
): void {
  if (validation.counts.hard_failed !== 0 || validation.gate !== plan.impact.final_gate.kind ||
      validation.identities.base_tree !== plan.base.tree ||
      validation.identities.diff_sha256 !== plan.diff_sha256 ||
      validation.identities.impact_sha256 !== plan.impact_sha256 ||
      validation.identities.head_sha !== approval.validation.head_sha ||
      validation.identities.head_tree !== tree || validation.required_job !== "validate-final" ||
      Number(validation.run_log.run_id) !== approval.validation.run_id) {
    throw new Error("Retention source tree or selected validation gate differs from authoritative evidence")
  }
}
