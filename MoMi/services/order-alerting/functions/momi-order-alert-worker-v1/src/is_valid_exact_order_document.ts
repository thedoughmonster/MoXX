import { isSameJsonValue } from "./is_same_json_value.ts"
import { isValidOrderPresentation } from "./is_valid_order_presentation.ts"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const documentKeys = new Set([
  "id", "location_id", "channel_kind", "approval_status", "voided",
  "submitted_at", "business_date", "opened_at", "closed_at", "guest_count",
  "fulfillment", "presentation",
])
const fulfillmentKeys = new Set(["timing", "at"])

export function isValidExactOrderDocument(
  input: unknown,
  orderId: string,
  presentation: unknown,
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
    !isValidOrderPresentation(presentation, 2)) return false
  const value = input as Record<string, unknown>
  const fulfillment = value.fulfillment as Record<string, unknown> | null
  const embedded = value.presentation
  if (typeof fulfillment !== "object" || fulfillment === null ||
    Array.isArray(fulfillment) ||
    !isValidOrderPresentation(embedded, 2)) return false
  const presentationValue = presentation as Record<string, unknown>
  return Object.keys(value).every((key) => documentKeys.has(key)) &&
    Object.keys(fulfillment).every((key) => fulfillmentKeys.has(key)) &&
    value.id === orderId && uuidPattern.test(orderId) &&
    typeof value.location_id === "string" &&
    uuidPattern.test(value.location_id) &&
    (value.channel_kind === "in_store" ||
      value.channel_kind === "out_of_store" ||
      value.channel_kind === "unknown") &&
    (value.approval_status === "approved" ||
      value.approval_status === "future" ||
      value.approval_status === "pending" ||
      value.approval_status === "rejected" ||
      value.approval_status === "unknown") &&
    typeof value.voided === "boolean" &&
    (value.submitted_at === undefined || value.submitted_at === null ||
      (typeof value.submitted_at === "string" &&
        !Number.isNaN(Date.parse(value.submitted_at)))) &&
    (value.opened_at === undefined || value.opened_at === null ||
      (typeof value.opened_at === "string" &&
        !Number.isNaN(Date.parse(value.opened_at)))) &&
    (value.closed_at === undefined || value.closed_at === null ||
      (typeof value.closed_at === "string" &&
        !Number.isNaN(Date.parse(value.closed_at)))) &&
    (value.business_date === undefined || value.business_date === null ||
      (typeof value.business_date === "string" && value.business_date !== "")) &&
    (value.guest_count === undefined || value.guest_count === null ||
      (typeof value.guest_count === "number" &&
        Number.isFinite(value.guest_count) && value.guest_count >= 0)) &&
    (fulfillment.timing === "scheduled" || fulfillment.timing === "asap" ||
      fulfillment.timing === "unknown") &&
    (fulfillment.at === undefined || fulfillment.at === null ||
      (typeof fulfillment.at === "string" &&
        !Number.isNaN(Date.parse(fulfillment.at)))) &&
    presentationValue.fulfillment_timing === fulfillment.timing &&
    (presentationValue.fulfillment_at ?? null) === (fulfillment.at ?? null) &&
    isSameJsonValue(embedded, presentation)
}
