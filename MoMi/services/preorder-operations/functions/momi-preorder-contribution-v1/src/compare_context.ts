import { correction, type Correction } from "./correction.ts"
import type { Selection } from "./types.ts"

const fields = [
  ["campaign_ref", "campaign", "stale", "refresh"],
  ["menu_ref", "menu", "stale", "refresh"],
  ["event_ref", "event", "stale", "refresh"],
  ["product_ref", "product", "product_changed", "edit_item"],
  ["option_refs", "option", "option_changed", "edit_item"],
  ["eligibility_evidence", "eligibility", "eligibility_changed", "edit_item"],
  ["allergen_evidence", "allergen", "allergen_changed", "edit_item"],
  ["rule_refs", "eligibility", "eligibility_changed", "refresh"],
  ["disclosures", "disclosures", "disclosure_changed", "review_disclosures"],
] as const

export function compareContext(
  supplied: Selection, current: Selection,
): Correction[] {
  const changed = fields.flatMap(([key, field, code, action]) =>
    JSON.stringify(supplied[key]) === JSON.stringify(current[key]) ? [] : [
      correction(code, field,
        `The preorder ${field.replace("_", " ")} changed. Review the current selection.`,
        action),
    ])
  if (supplied.fulfillment_ref.resource_id !==
      current.fulfillment_ref.resource_id) changed.push(correction(
    "fulfillment_changed", "window", "The pickup window changed.",
    "choose_fulfillment"))
  if (supplied.fulfillment_evidence.pickup_date !==
      current.fulfillment_evidence.pickup_date) changed.push(correction(
    "fulfillment_changed", "pickup_date", "The pickup date changed.",
    "choose_fulfillment"))
  if (JSON.stringify(supplied.fulfillment_evidence.location_ref) !==
      JSON.stringify(current.fulfillment_evidence.location_ref)) changed.push(
    correction("fulfillment_changed", "location",
      "The pickup location changed.", "choose_fulfillment"))
  if (supplied.fulfillment_evidence.availability !==
      current.fulfillment_evidence.availability) changed.push(correction(
    "capacity_changed", "capacity", "Pickup availability changed.",
    "choose_fulfillment"))
  if (supplied.fulfillment_evidence.cutoff_at !==
      current.fulfillment_evidence.cutoff_at) changed.push(correction(
    "fulfillment_changed", "cutoff", "The order cutoff changed.",
    "choose_fulfillment"))
  if (JSON.stringify(supplied.pricing.unit_price) !==
      JSON.stringify(current.pricing.unit_price)) changed.push(correction(
    "price_changed", "price", "The preorder price changed. Review the current price.",
    "review_price"))
  if (supplied.pricing.deposit_rule !== current.pricing.deposit_rule ||
      JSON.stringify(supplied.pricing.deposit) !==
        JSON.stringify(current.pricing.deposit)) changed.push(correction(
    "deposit_changed", "deposit",
    "The preorder payment or deposit rule changed. Review the current rule.",
    "review_price"))
  if (Date.parse(supplied.valid_until) <= Date.now()) changed.push(correction(
    "expired", "eligibility", "The saved preorder evidence expired. Refresh it.",
    "refresh"))
  return changed
}
