import { isValidOrderPresentation } from "./is_valid_order_presentation.ts"
import { canonicalOrderContractKey } from "./types.ts"
import type { CanonicalOrderApiSuccess, CanonicalReadCapability,
  ClaimedWork } from "./types.ts"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidCanonicalOrderResponse(
  body: unknown,
  job: ClaimedWork,
  readCapability: CanonicalReadCapability,
): body is CanonicalOrderApiSuccess {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false
  }
  const value = body as Record<string, unknown>
  const document = value.order_document as Record<string, unknown> | null
  const provenance = value.provenance as Record<string, unknown> | null
  const freshness = value.freshness as Record<string, unknown> | null
  return job.api_contract_key === canonicalOrderContractKey &&
    value.ok === true && value.contract_key === canonicalOrderContractKey &&
    value.contract_version === job.api_contract_version &&
    value.work_id === readCapability.work_id &&
    value.order_id === job.order_id &&
    typeof value.trace_id === "string" && uuidPattern.test(value.trace_id) &&
    Number.isInteger(value.schema_version) &&
    (value.schema_version as number) > 0 &&
    typeof document === "object" && document !== null &&
    !Array.isArray(document) && document.id === job.order_id &&
    typeof document.location_id === "string" &&
    uuidPattern.test(document.location_id) &&
    isValidOrderPresentation(value.order_presentation) &&
    typeof provenance === "object" && provenance !== null &&
    !Array.isArray(provenance) &&
    provenance.source_system === job.source_system &&
    provenance.resource_type === "order" &&
    typeof provenance.source_version_id === "string" &&
    provenance.source_version_id.length > 0 &&
    typeof provenance.observed_at === "string" &&
    !Number.isNaN(Date.parse(provenance.observed_at)) &&
    typeof freshness === "object" && freshness !== null &&
    !Array.isArray(freshness) &&
    freshness.observed_at === provenance.observed_at &&
    typeof freshness.projected_at === "string" &&
    !Number.isNaN(Date.parse(freshness.projected_at)) &&
    typeof freshness.age_seconds === "number" && freshness.age_seconds >= 0
}
