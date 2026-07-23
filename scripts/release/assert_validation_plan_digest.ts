import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { BoundPlan, ValidationReceipt } from "../dev_loop/types.ts"

export function assertValidationPlanDigest(
  plan: BoundPlan,
  receipt: ValidationReceipt,
): void {
  if (
    plan.head.sha !== receipt.identities.head_sha ||
    hashText(canonicalJson(plan)) !== receipt.identities.plan_sha256
  ) throw new Error("Validation receipt does not match its exact committed plan")
}
