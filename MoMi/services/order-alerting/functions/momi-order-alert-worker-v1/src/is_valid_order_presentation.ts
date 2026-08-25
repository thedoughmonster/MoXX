import type { OrderPresentation } from "./types.ts"
import { isValidOrderItem } from "./is_valid_order_item.ts"

const exactPresentationKeys = new Set([
  "presentation_version", "display_number", "customer_label",
  "fulfillment_timing", "fulfillment_at", "fulfillment_epoch", "item_count",
  "total_amount", "items",
])

export function isValidOrderPresentation(
  input: unknown,
  expectedVersion: 1 | 2 = 1,
): input is OrderPresentation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false
  }
  const value = input as Record<string, unknown>
  const timingValid = value.fulfillment_timing === "scheduled" ||
    value.fulfillment_timing === "asap" ||
    value.fulfillment_timing === "unknown"
  return (expectedVersion === 1 ||
      Object.keys(value).every((key) => exactPresentationKeys.has(key))) &&
    value.presentation_version === expectedVersion &&
    typeof value.display_number === "string" &&
    value.display_number.length > 0 && value.display_number.length <= 80 &&
    (value.customer_label === undefined || value.customer_label === null ||
      (typeof value.customer_label === "string" &&
        value.customer_label.length > 0 && value.customer_label.length <= 200)) &&
    (timingValid || (expectedVersion === 1 &&
      value.fulfillment_timing === undefined)) &&
    (value.fulfillment_at === null || (expectedVersion === 2 &&
      value.fulfillment_at === undefined) ||
      (typeof value.fulfillment_at === "string" &&
        !Number.isNaN(Date.parse(value.fulfillment_at)))) &&
    (value.fulfillment_epoch === null || (expectedVersion === 2 &&
      value.fulfillment_epoch === undefined) ||
      (Number.isInteger(value.fulfillment_epoch) &&
        Number(value.fulfillment_epoch) >= 0)) &&
    typeof value.item_count === "number" && Number.isFinite(value.item_count) &&
    value.item_count >= 0 && (value.total_amount === null ||
      (typeof value.total_amount === "number" &&
        Number.isFinite(value.total_amount) && value.total_amount >= 0)) &&
    Array.isArray(value.items) && value.items.every(isValidOrderItem)
}
