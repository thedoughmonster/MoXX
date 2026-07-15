import assert from "node:assert/strict"
import test from "node:test"

import { isValidOrderResponse } from "../src/is_valid_order_response.ts"
import { canonicalOrderContractKey } from "../src/types.ts"
import type { CanonicalOrderApiSuccess, CanonicalReadCapability,
  ClaimedWork } from "../src/types.ts"

const orderId = "7bf8f483-c516-4c71-8f80-92c2cc8c25ff"
const locationId = "97c5ae65-901a-45f6-b623-8b018df3bf91"
const readCapability: CanonicalReadCapability = {
  work_id: "501",
  capability_token: "f10902d2-ef2d-4814-9f72-191c3f7f929c",
}
const job: ClaimedWork = {
  disposition: "claimed",
  work_id: "81",
  attempt_id: "82",
  invocation_id: "eb4d0412-e4d3-4319-92fd-e6d660bdd812",
  source_system: "toast",
  source_version_id: "e28479db-b7b6-4354-984d-f56d250c01a7",
  location_id: null,
  order_id: orderId,
  api_contract_key: canonicalOrderContractKey,
  api_contract_version: 1,
  api_route_path: "/functions/v1/momi-orders-get-by-id-v1",
  trigger_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}

const response: CanonicalOrderApiSuccess = {
  ok: true,
  contract_key: canonicalOrderContractKey,
  contract_version: 1,
  trace_id: "8de3df64-33f5-4d1f-9569-f6786798f182",
  work_id: readCapability.work_id,
  order_id: orderId,
  schema_version: 1,
  order_document: { id: orderId, location_id: locationId,
    channel: "In Store", presentation: {} },
  order_presentation: { presentation_version: 1, display_number: "42",
    fulfillment_at: null, fulfillment_epoch: null, item_count: 0,
    total_amount: null, items: [] },
  provenance: { source_system: "toast", resource_type: "order",
    source_version_id: "webhook:source-1",
    observed_at: "2026-07-14T12:00:00.000Z" },
  freshness: { observed_at: "2026-07-14T12:00:00.000Z",
    projected_at: "2026-07-14T12:00:01.000Z", age_seconds: 1 },
}

test("accepts only the canonical order bound to the claimed work", () => {
  assert.equal(isValidOrderResponse(response, job, readCapability), true)
  assert.equal(isValidOrderResponse(response, job), false)
  assert.equal(isValidOrderResponse(response, job, {
    ...readCapability, work_id: "502",
  }), false)
  for (const changed of [
    { contract_key: "momi.toast_orders.get_by_id.v1" },
    { order_id: "ce9f3558-86ea-4524-888b-12c5d35fbd15" },
    { order_document: { ...response.order_document,
      id: "ce9f3558-86ea-4524-888b-12c5d35fbd15" } },
    { provenance: { ...response.provenance, source_system: "square" } },
    { provenance: { ...response.provenance, resource_type: "payment" } },
    { freshness: { ...response.freshness, observed_at: "2026-07-13" } },
    { order_presentation: null },
  ]) assert.equal(isValidOrderResponse(
    { ...response, ...changed }, job, readCapability,
  ), false)
})
