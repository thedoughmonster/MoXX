import assert from "node:assert/strict"
import test from "node:test"
import { isValidOrderResponse } from "../src/is_valid_order_response.ts"
import type { ClaimedWork, OrderApiSuccess } from "../src/types.ts"

const job: ClaimedWork = {
  disposition: "claimed",
  work_id: "8",
  attempt_id: "9",
  invocation_id: "eb4d0412-e4d3-4319-92fd-e6d660bdd812",
  source_system: "square",
  source_version_id: "square-version-7",
  location_id: "location-1",
  order_id: "order-1",
  api_contract_key: "momi.square_orders.get_by_id.v1",
  api_contract_version: 1,
  api_route_path: "/functions/v1/momi-square-orders-get-by-id-v1",
  trigger_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}

const response: OrderApiSuccess = {
  ok: true,
  contract_key: job.api_contract_key,
  contract_version: job.api_contract_version,
  trace_id: "8de3df64-33f5-4d1f-9569-f6786798f182",
  work_id: job.work_id,
  work_source_version_id: job.source_version_id,
  source_system: job.source_system,
  source_version_id: job.source_version_id,
  location_id: job.location_id,
  order_id: job.order_id,
  retrieved_at: "2026-07-13T12:00:00.000Z",
  content_hash: "a".repeat(64),
  payload: { id: job.order_id, line_items: [] },
  order_presentation: {
    presentation_version: 1,
    display_number: "42",
    customer_label: "Taylor Morgan",
    fulfillment_at: "2026-07-13T12:30:00.000Z",
    fulfillment_epoch: 1_783_945_800,
    item_count: 1,
    total_amount: 7.5,
    items: [{ name: "Latte", quantity: 1, modifiers: [] }],
  },
}

test("accepts an owned response bound to the claimed work", () => {
  assert.equal(isValidOrderResponse(response, job), true)
  const presentation = { ...response.order_presentation }
  delete presentation.customer_label
  assert.equal(isValidOrderResponse({
    ...response,
    order_presentation: presentation,
  }, job), true)
})

test("rejects contract, source, order, and version mismatches", () => {
  for (const changed of [
    { contract_key: "momi.other.get.v1" },
    { contract_version: 2 },
    { work_id: "99" },
    { source_system: "toast" },
    { order_id: "other-order" },
    { location_id: "other-location" },
    { source_version_id: "other-version" },
    { work_source_version_id: "other-version" },
    { order_presentation: null },
    { order_presentation: { presentation_version: 2, items: [] } },
    { order_presentation: {
      ...response.order_presentation,
      customer_label: "x".repeat(201),
    } },
  ]) {
    assert.equal(isValidOrderResponse({ ...response, ...changed }, job), false)
  }
})
