import type { OrderPresentation } from "./types.ts"
import { isValidOrderItem } from "./is_valid_order_item.ts"

export function isValidOrderPresentation(
  input: unknown,
): input is OrderPresentation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false
  }
  const value = input as Record<string, unknown>
  return value.presentation_version === 1 &&
    typeof value.display_number === "string" &&
    value.display_number.length > 0 && value.display_number.length <= 80 &&
    (value.customer_label === undefined || value.customer_label === null ||
      (typeof value.customer_label === "string" &&
        value.customer_label.length > 0 && value.customer_label.length <= 200)) &&
    (value.fulfillment_at === null ||
      (typeof value.fulfillment_at === "string" &&
        !Number.isNaN(Date.parse(value.fulfillment_at)))) &&
    (value.fulfillment_epoch === null ||
      (Number.isInteger(value.fulfillment_epoch) &&
        Number(value.fulfillment_epoch) >= 0)) &&
    typeof value.item_count === "number" && Number.isFinite(value.item_count) &&
    value.item_count >= 0 && (value.total_amount === null ||
      (typeof value.total_amount === "number" &&
        Number.isFinite(value.total_amount) && value.total_amount >= 0)) &&
    Array.isArray(value.items) && value.items.every(isValidOrderItem)
}
