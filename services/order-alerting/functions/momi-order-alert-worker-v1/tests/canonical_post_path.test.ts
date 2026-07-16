import assert from "node:assert/strict"
import test from "node:test"

import { callOrderApi } from "../src/call_order_api.ts"
import { handleRequest } from "../src/handle_request.ts"
import { isValidOrderResponse } from "../src/is_valid_order_response.ts"
import { exactOrderContractKey } from "../src/types.ts"
import type { DeliveryWorkerStore } from "../src/delivery_types.ts"
import type { CanonicalReadCapability, ClaimedWork } from "../src/types.ts"

const eventId = "aeb85053-7aef-4f6d-8b74-e4643b588157"
const orderId = "7bf8f483-c516-4c71-8f80-92c2cc8c25ff"
const deliveryToken = "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65"
const alertWorkToken = "d086ff54-b38f-4cdb-a5e1-916ccd915210"
const readCapability: CanonicalReadCapability = {
  contract_key: exactOrderContractKey,
  work_id: "501",
  capability_token: "f10902d2-ef2d-4814-9f72-191c3f7f929c",
}
const job: ClaimedWork = {
  disposition: "claimed", work_id: "52", attempt_id: "53",
  invocation_id: "eb4d0412-e4d3-4319-92fd-e6d660bdd812",
  source_system: "toast",
  source_version_id: "e28479db-b7b6-4354-984d-f56d250c01a7",
  location_id: null, order_id: orderId,
  api_contract_key: exactOrderContractKey, api_contract_version: 1,
  api_route_path: "/functions/v1/momi-orders-get-by-version-v1",
  trigger_token: alertWorkToken,
}
const presentation = { presentation_version: 2 as const,
  display_number: "42", fulfillment_timing: "asap" as const,
  fulfillment_at: null, fulfillment_epoch: null, item_count: 0,
  total_amount: null, items: [] }
const provenance = { source_system: "toast", resource_type: "order",
  source_id: "source-order-1", source_version_id: "source-1",
  source_content_hash: "a".repeat(64),
  projection_contract: "canonical-resource-v2",
  observed_at: "2026-07-14T12:00:00.000Z" }

test("POST keeps delivery, alert-work, and canonical-read authority distinct",
  async () => {
    const steps: string[] = []
    const store: DeliveryWorkerStore = {
      beginDelivery: (event, message, token) => {
        assert.deepEqual([event, message, token],
          [eventId, "41", deliveryToken])
        steps.push("delivery_claim")
        return Promise.resolve(true)
      },
      stageEventWork: () => Promise.resolve({ disposition: "ready",
        event_name: "warehouse.order.observed", work_id: job.work_id,
        trigger_token: alertWorkToken, work_status: "pending" }),
      executeWork: async (input, delivery) => {
        assert.deepEqual(input, { work_id: job.work_id,
          trigger_token: alertWorkToken })
        assert.deepEqual(delivery, { event_id: eventId, message_id: "41",
          capability_token: deliveryToken })
        steps.push("read_capability_issue")
        const api = await callOrderApi(job, "https://project.supabase.co",
          "publishable", readCapability,
          (_url, init) => {
            assert.deepEqual(JSON.parse(String(init?.body)), {
              work_id: readCapability.work_id, order_id: orderId,
              order_version_id: job.source_version_id,
              capability_token: readCapability.capability_token,
            })
            steps.push("canonical_read")
            return Promise.resolve(Response.json({ ok: true,
              contract_key: exactOrderContractKey, contract_version: 1,
              trace_id: "8de3df64-33f5-4d1f-9569-f6786798f182",
              work_id: readCapability.work_id, order_id: orderId,
              order_version_id: job.source_version_id, schema_version: 2,
              order_document: { id: orderId,
                location_id: "97c5ae65-901a-45f6-b623-8b018df3bf91",
                channel_kind: "in_store", approval_status: "approved",
                voided: false, submitted_at: "2026-07-14T12:00:00.000Z",
                fulfillment: { timing: "asap", at: null }, presentation },
              order_presentation: presentation,
              provenance,
              freshness: { observed_at: "2026-07-14T12:00:00.000Z",
                projected_at: "2026-07-14T12:00:01.000Z", age_seconds: 1 },
            }))
          })
        assert.equal(isValidOrderResponse(
          api.body, job, readCapability), true)
        steps.push("evaluation")
        return { status: 200, body: { ok: true } }
      },
      acknowledgeDelivery: (event, message, token) => {
        assert.deepEqual([event, message, token],
          [eventId, "41", deliveryToken])
        steps.push("delivery_ack")
        return Promise.resolve(true)
      },
      failDelivery: () => Promise.resolve("retry_wait"),
    }
    const response = await handleRequest(new Request("https://worker.test", {
      method: "POST", body: JSON.stringify({ event_id: eventId,
        message_id: "41", capability_token: deliveryToken }),
    }), undefined, store)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).outcome, "processed")
    assert.deepEqual(steps, ["delivery_claim", "read_capability_issue",
      "canonical_read", "evaluation", "delivery_ack"])
  })

test("POST rejects a legacy token field on the delivery path", async () => {
  const response = await handleRequest(new Request("https://worker.test", {
    method: "POST", body: JSON.stringify({ event_id: eventId,
      message_id: "41", trigger_token: deliveryToken }),
  }))
  assert.equal(response.status, 400)
})
