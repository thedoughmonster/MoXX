import assert from "node:assert/strict"
import test from "node:test"

import { isValidOrderResponse } from "../src/is_valid_order_response.ts"
import { exactOrderContractKey } from "../src/types.ts"
import type { CanonicalReadCapability, ClaimedWork,
  ExactOrderApiSuccess } from "../src/types.ts"

const orderId = "7bf8f483-c516-4c71-8f80-92c2cc8c25ff"
const versionId = "e28479db-b7b6-4354-984d-f56d250c01a7"
const readCapability: CanonicalReadCapability = {
  contract_key: exactOrderContractKey,
  work_id: "501",
  capability_token: "f10902d2-ef2d-4814-9f72-191c3f7f929c",
}
const job: ClaimedWork = {
  disposition: "claimed", work_id: "81", attempt_id: "82",
  invocation_id: "eb4d0412-e4d-4319-92fd-e6d660bdd812",
  source_system: "toast", source_version_id: versionId, location_id: null,
  order_id: orderId, api_contract_key: exactOrderContractKey,
  api_contract_version: 1,
  api_route_path: "/functions/v1/momi-orders-get-by-version-v1",
  trigger_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}
const presentation: ExactOrderApiSuccess["order_presentation"] = {
  presentation_version: 2, display_number: "42",
  fulfillment_timing: "scheduled", fulfillment_at: null,
  fulfillment_epoch: null, item_count: 0, total_amount: null, items: [],
}
const response: ExactOrderApiSuccess = {
  ok: true, contract_key: exactOrderContractKey, contract_version: 1,
  trace_id: "8de3df64-33f5-4d1f-9569-f6786798f182",
  work_id: readCapability.work_id, order_id: orderId,
  order_version_id: versionId, schema_version: 2,
  order_document: { id: orderId,
    location_id: "97c5ae65-901a-45f6-b623-8b018df3bf91",
    channel_kind: "in_store", approval_status: "approved", voided: false,
    submitted_at: "2026-07-14T11:59:00.000Z",
    fulfillment: { timing: "scheduled", at: null }, presentation },
  order_presentation: presentation,
  provenance: { source_system: "toast", resource_type: "order",
    source_id: "source-order-1", source_version_id: "webhook:source-1",
    source_content_hash: "a".repeat(64),
    projection_contract: "canonical-resource-v2",
    observed_at: "2026-07-14T12:00:00.000Z" },
  freshness: { observed_at: "2026-07-14T12:00:00.000Z",
    projected_at: "2026-07-14T12:00:01.000Z", age_seconds: 1 },
}

test("accepts only an exact v2 response bound to the claimed version", () => {
  assert.equal(isValidOrderResponse(response, job, readCapability), true)
  assert.equal(isValidOrderResponse(response, job), false)
  for (const changed of [
    { contract_key: "momi.orders.get_by_id.v1" },
    { order_version_id: "b413dbba-b83c-4b67-8afd-b5c57f9cb163" },
    { schema_version: 1 },
    { order_id: "ce9f3558-86ea-4524-888b-12c5d35fbd15" },
    { provenance: { ...response.provenance, source_system: "square" } },
    { provenance: { ...response.provenance,
      projection_contract: "canonical-resource-v1" } },
    { freshness: { ...response.freshness, projected_at: "invalid" } },
  ]) assert.equal(isValidOrderResponse(
    { ...response, ...changed }, job, readCapability), false)
})

test("accepts only normalized document enums, UUIDs, and timestamps", () => {
  for (const channel_kind of ["in_store", "out_of_store", "unknown"] as const) {
    assert.equal(isValidOrderResponse({ ...response, order_document: {
      ...response.order_document, channel_kind } }, job, readCapability), true)
  }
  for (const approval_status of [
    "approved", "future", "pending", "rejected", "unknown",
  ] as const) assert.equal(isValidOrderResponse({ ...response,
    order_document: { ...response.order_document, approval_status },
  }, job, readCapability), true)
  for (const order_document of [
    { ...response.order_document, id: "not-a-uuid" },
    { ...response.order_document, location_id: "not-a-uuid" },
    { ...response.order_document, channel_kind: "dine_in" },
    { ...response.order_document, approval_status: "denied" },
    { ...response.order_document, voided: "false" },
    { ...response.order_document, submitted_at: "invalid" },
    { ...response.order_document, fulfillment: null },
    { ...response.order_document,
      fulfillment: { timing: "later", at: null } },
    { ...response.order_document,
      fulfillment: { timing: "asap", at: "invalid" } },
  ]) assert.equal(isValidOrderResponse(
    { ...response, order_document }, job, readCapability), false)
  assert.equal(isValidOrderResponse({ ...response, order_document: {
    ...response.order_document, submitted_at: null,
    fulfillment: { timing: "scheduled", at: "2026-07-14T12:30:00.000Z" },
    presentation: { ...presentation,
      fulfillment_at: "2026-07-14T12:30:00.000Z" },
  }, order_presentation: { ...presentation,
    fulfillment_at: "2026-07-14T12:30:00.000Z" },
  }, job, readCapability), true)
})

test("requires presentation v2 timing to match document timing", () => {
  for (const timing of ["scheduled", "asap", "unknown"] as const) {
    const timedPresentation = { ...presentation, fulfillment_timing: timing }
    assert.equal(isValidOrderResponse({ ...response,
      order_document: { ...response.order_document,
        fulfillment: { timing, at: null }, presentation: timedPresentation },
      order_presentation: timedPresentation,
    }, job, readCapability), true)
  }
  for (const order_presentation of [
    { ...response.order_presentation, presentation_version: 1 },
    { ...response.order_presentation, fulfillment_timing: "later" },
    { ...response.order_presentation, fulfillment_timing: "asap" },
  ]) assert.equal(isValidOrderResponse(
    { ...response, order_presentation }, job, readCapability), false)
})
