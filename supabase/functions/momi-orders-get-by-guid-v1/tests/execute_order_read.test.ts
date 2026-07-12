import assert from "node:assert/strict"
import test from "node:test"

import { executeOrderRead } from "../execute_order_read.ts"
import type { OrderReader } from "../types.ts"

test("maps authorization states and preserves the complete order payload", async () => {
  const input = {
    work_id: "7",
    order_guid: "order-1",
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
      work_order_version_id: "8",
    }) as unknown as OrderReader,
  )
  assert.equal(inactive.status, 503)
  assert.equal(inactive.body.error, "contract_inactive")

  const missing = await executeOrderRead(
    input,
    traceId,
    Promise.resolve.bind(Promise, {
      disposition: "order_not_found",
      work_order_version_id: "8",
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
      work_order_version_id: "8",
      order: {
        order_guid: "order-1",
        restaurant_guid: "restaurant-1",
        order_version_id: "9",
        retrieved_at: "2026-07-12T12:00:00.000Z",
        content_hash: "a".repeat(64),
        payload,
      },
    }) as unknown as OrderReader,
  )
  assert.equal(found.status, 200)
  assert.equal(found.body.contract_key, "momi.orders.get_by_guid.v1")
  assert.equal(found.body.contract_version, 1)
  assert.equal(found.body.work_order_version_id, "8")
  assert.equal(found.body.order_version_id, "9")
  assert.strictEqual(found.body.payload, payload)
})
