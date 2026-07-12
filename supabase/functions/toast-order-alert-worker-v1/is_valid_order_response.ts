import { orderApiFunctionKey } from "./types.ts"
import type { ClaimedWork, OrderApiSuccess } from "./types.ts"

export function isValidOrderResponse(
  body: unknown,
  job: ClaimedWork,
): body is OrderApiSuccess {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false
  }
  const value = body as Record<string, unknown>
  const payload = value.payload
  return value.ok === true && value.contract_key === orderApiFunctionKey &&
    value.contract_version === 1 && value.work_id === job.work_id &&
    value.work_order_version_id === job.order_version_id &&
    value.order_guid === job.order_guid &&
    value.order_version_id === job.order_version_id &&
    typeof value.trace_id === "string" && value.trace_id.length > 0 &&
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
}
