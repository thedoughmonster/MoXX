import assert from "node:assert/strict"
import test from "node:test"

import { executeOrderRead } from "../execute_order_read.ts"
import type { OrderReader } from "../types.ts"

test("maps authorization states and preserves the complete order payload", async () => {
  const input = {
    work_id: "7",
    order_id: "order-1",
    trigger_token: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  }
  const traceId = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  const forbidden = await executeOrderRead(
    input,
    traceId,
    Promise.resolve.bind(
      Promise,
      { disposition: "forbidden" },
    ) as unknown as OrderReader,
  )
  assert.equal(forbidden.status, 403)
  assert.equal(forbidden.body.error, "forbidden")

  const inactive = await executeOrderRead(
    input,
    traceId,
    Promise.resolve.bind(Promise, {
      disposition: "contract_inactive",
      work_source_version_id: "8",
    }) as unknown as OrderReader,
  )
  assert.equal(inactive.status, 503)
  assert.equal(inactive.body.error, "contract_inactive")

  const missing = await executeOrderRead(
    input,
    traceId,
    Promise.resolve.bind(Promise, {
      disposition: "order_not_found",
      work_source_version_id: "8",
    }) as unknown as OrderReader,
  )
  assert.equal(missing.status, 404)
  assert.equal(missing.body.error, "order_not_found")

  const payload = { guid: "order-1", checks: [{ guid: "check-1" }] }
  const found = await executeOrderRead(
    input,
    traceId,
    Promise.resolve.bind(Promise, {
      disposition: "found",
      work_source_version_id: "8",
      order: {
        source_system: "toast",
        source_version_id: "9",
        order_id: "order-1",
        location_id: "restaurant-1",
        retrieved_at: "2026-07-12T12:00:00.000Z",
        content_hash: "a".repeat(64),
        payload,
      },
    }) as unknown as OrderReader,
  )
  assert.equal(found.status, 200)
  assert.equal(found.body.contract_key, "momi.toast_orders.get_by_id.v1")
  assert.equal(found.body.contract_version, 1)
  assert.equal(found.body.work_source_version_id, "8")
  assert.equal(found.body.source_system, "toast")
  assert.equal(found.body.source_version_id, "9")
  assert.equal(found.body.order_id, "order-1")
  assert.equal(found.body.location_id, "restaurant-1")
  assert.strictEqual(found.body.payload, payload)
})
