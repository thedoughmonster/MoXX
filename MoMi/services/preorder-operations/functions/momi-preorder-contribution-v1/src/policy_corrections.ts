import { correction, type Correction } from "./correction.ts"
import type { Input } from "./types.ts"

export function policyCorrections(
  input: Input, data: Record<string, unknown>,
): Correction[] {
  const catalog = data.catalog as Array<Record<string, unknown>> ?? []
  const windows = data.fulfillment_windows as Array<Record<string, unknown>> ?? []
  const item = catalog.find((candidate) =>
    candidate.item_id === input.selection.product_ref.resource_id)
  const window = windows.find((candidate) =>
    candidate.window_id === input.selection.fulfillment_ref.resource_id)
  const issues: Correction[] = []
  if (!window) issues.push(correction("fulfillment_changed", "window",
    "The selected pickup window is no longer available.", "choose_fulfillment"))
  else if (window.availability === "sold_out") issues.push(correction(
    "sold_out", "capacity", "The selected pickup date is sold out.",
    "choose_fulfillment"))
  else if (window.availability === "closed") issues.push(correction(
    "cutoff_passed", "cutoff", "Ordering has closed for this pickup window.",
    "choose_fulfillment"))
  if (!item || item.available !== true) issues.push(correction(
    "eligibility_changed", "eligibility",
    "The selected product is not eligible for this pickup date.", "edit_item"))
  else if (input.selection.quantity > (item.maximum_quantity as number)) {
    issues.push(correction("quantity_changed", "quantity",
      "The selected quantity exceeds the current limit.", "edit_quantity"))
  }
  if (item) {
    const choices = (item.option_groups as Array<Record<string, unknown>> ?? [])
      .flatMap((group) => group.choices as Array<Record<string, unknown>> ?? [])
    const selected = new Set(input.selection.option_refs.map((ref) =>
      ref.resource_id))
    if (choices.some((choice) => selected.has(choice.choice_id as string) &&
      choice.available !== true)) issues.push(correction(
      "option_changed", "option", "A selected option is no longer available.",
      "edit_item"))
  }
  return issues
}
