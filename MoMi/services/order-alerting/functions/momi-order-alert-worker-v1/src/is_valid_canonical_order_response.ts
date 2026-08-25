import { isValidExactOrderDocument } from "./is_valid_exact_order_document.ts"
import { isValidExactOrderProvenance } from "./is_valid_exact_order_provenance.ts"
import { exactOrderContractKey } from "./types.ts"
import type { CanonicalReadCapability, ExactOrderApiSuccess,
  ClaimedWork } from "./types.ts"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const responseKeys = new Set([
  "ok", "contract_key", "contract_version", "trace_id", "work_id",
  "order_id", "order_version_id", "schema_version", "order_document",
  "order_presentation", "provenance", "freshness",
])
const freshnessKeys = new Set(["observed_at", "projected_at", "age_seconds"])

export function isValidCanonicalOrderResponse(
  body: unknown,
  job: ClaimedWork,
  readCapability: CanonicalReadCapability,
): body is ExactOrderApiSuccess {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false
  }
  const value = body as Record<string, unknown>
  const provenance = value.provenance as Record<string, unknown> | null
  const freshness = value.freshness as Record<string, unknown> | null
  return Object.keys(value).every((key) => responseKeys.has(key)) &&
    Object.keys(value).length === responseKeys.size &&
    job.api_contract_key === exactOrderContractKey &&
    readCapability.contract_key === exactOrderContractKey &&
    value.ok === true && value.contract_key === exactOrderContractKey &&
    value.contract_version === job.api_contract_version &&
    value.work_id === readCapability.work_id &&
    value.order_id === job.order_id &&
    value.order_version_id === job.source_version_id &&
    typeof value.order_version_id === "string" &&
    uuidPattern.test(value.order_version_id) &&
    typeof value.trace_id === "string" && uuidPattern.test(value.trace_id) &&
    value.schema_version === 2 &&
    isValidExactOrderDocument(
      value.order_document, job.order_id, value.order_presentation) &&
    isValidExactOrderProvenance(provenance, job.source_system) &&
    typeof freshness === "object" && freshness !== null &&
    !Array.isArray(freshness) &&
    Object.keys(freshness).every((key) => freshnessKeys.has(key)) &&
    Object.keys(freshness).length === freshnessKeys.size &&
    freshness.observed_at === provenance.observed_at &&
    typeof freshness.projected_at === "string" &&
    !Number.isNaN(Date.parse(freshness.projected_at)) &&
    typeof freshness.age_seconds === "number" &&
    Number.isFinite(freshness.age_seconds) && freshness.age_seconds >= 0
}
