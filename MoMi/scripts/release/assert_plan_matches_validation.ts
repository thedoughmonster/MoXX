import type { BoundPlan, ValidationReceipt } from "../dev_loop/types.ts"

export function assertPlanMatchesValidation(
  plan: BoundPlan,
  receipt: ValidationReceipt,
): void {
  const developmentMatches =
    (receipt.identities.development_sha === plan.base.sha &&
      receipt.identities.development_tree === plan.base.tree) ||
    (receipt.identities.development_sha === plan.head.sha &&
      receipt.identities.development_tree === plan.head.tree)
  if (
    plan.base.sha !== receipt.identities.base_sha ||
    plan.base.tree !== receipt.identities.base_tree ||
    plan.head.sha !== receipt.identities.head_sha ||
    plan.head.tree !== receipt.identities.head_tree ||
    plan.diff_sha256 !== receipt.identities.diff_sha256 ||
    plan.impact_sha256 !== receipt.identities.impact_sha256 ||
    plan.impact.final_gate.kind !== receipt.gate || !developmentMatches
  ) {
    throw new Error(
      "Release plan differs materially from the authoritative validation receipt",
    )
  }
  if (plan.impact.classifications.unknown.length > 0) {
    throw new Error("Unknown impact cannot be released")
  }
}
