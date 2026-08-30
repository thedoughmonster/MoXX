import type { BoundPlan, ValidationReceipt } from "../dev_loop/types.ts"

export function assertPlanMatchesValidation(
  plan: BoundPlan,
  receipt: ValidationReceipt,
): void {
  if (
    plan.base.sha !== receipt.identities.base_sha ||
    plan.base.tree !== receipt.identities.base_tree ||
    plan.head.sha !== receipt.identities.head_sha ||
    plan.head.tree !== receipt.identities.head_tree ||
    plan.diff_sha256 !== receipt.identities.diff_sha256 ||
    plan.impact_sha256 !== receipt.identities.impact_sha256 ||
    plan.impact.final_gate.kind !== receipt.gate
  ) {
    throw new Error(
      "Release plan differs materially from the authoritative validation receipt",
    )
  }
  if (plan.impact.classifications.unknown.length > 0) {
    throw new Error("Unknown impact cannot be released")
  }
}
