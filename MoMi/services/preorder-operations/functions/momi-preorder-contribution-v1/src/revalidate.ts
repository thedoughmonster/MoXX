import { buildContext } from "./build_context.ts"
import { compareContext } from "./compare_context.ts"
import { correction } from "./correction.ts"
import { policyCorrections } from "./policy_corrections.ts"
import type { Input } from "./types.ts"

export function revalidate(input: Input, data: Record<string, unknown> | null) {
  if (!data) return { outcome: "rejected", context: null, corrections: [
    correction("missing_configuration", "campaign",
      "Preordering is unavailable because required configuration is missing.",
      "contact_shop"),
  ] }
  const context = buildContext(input, data)
  if (!context) return { outcome: "rejected", context: null, corrections: [
    correction("incompatible", "product",
      "The saved preorder selection is no longer compatible.", "edit_item"),
  ] }
  const blocking = policyCorrections(input, data)
  const differences = compareContext(input.selection, context)
  const corrections = [...blocking, ...differences]
  return { outcome: blocking.length > 0 ? "rejected" :
    differences.length > 0 ? "stale" : "accepted", context, corrections }
}
