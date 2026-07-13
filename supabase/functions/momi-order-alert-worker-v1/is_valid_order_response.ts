import type { ClaimedWork, OrderApiSuccess } from "./types.ts"
import { isValidOrderPresentation } from "./is_valid_order_presentation.ts"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidOrderResponse(
  body: unknown,
  job: ClaimedWork,
): body is OrderApiSuccess {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false
  }
  const value = body as Record<string, unknown>
  const payload = value.payload
  return value.ok === true && value.contract_key === job.api_contract_key &&
    value.contract_version === job.api_contract_version &&
    value.work_id === job.work_id &&
    value.work_source_version_id === job.source_version_id &&
    value.source_system === job.source_system &&
    value.source_version_id === job.source_version_id &&
    value.location_id === job.location_id && value.order_id === job.order_id &&
    typeof value.trace_id === "string" && uuidPattern.test(value.trace_id) &&
    typeof value.retrieved_at === "string" &&
    !Number.isNaN(Date.parse(value.retrieved_at)) &&
    typeof value.content_hash === "string" &&
    /^[0-9a-f]{64}$/.test(value.content_hash) &&
    typeof payload === "object" && payload !== null && !Array.isArray(payload) &&
    isValidOrderPresentation(value.order_presentation)
}
