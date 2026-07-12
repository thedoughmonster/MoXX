import assert from "node:assert/strict"
import test from "node:test"

import { parseOrderReadRequest } from "../parse_request.ts"

test("accepts only the strict durable order-read capability", () => {
  const token = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  assert.deepEqual(
    parseOrderReadRequest({
      work_id: 42,
      order_guid: "order-1",
      trigger_token: token,
    }),
    { work_id: "42", order_guid: "order-1", trigger_token: token },
  )
  assert.deepEqual(
    parseOrderReadRequest({
      work_id: "9223372036854775807",
      order_guid: "order-1",
      trigger_token: token,
    }),
    {
      work_id: "9223372036854775807",
      order_guid: "order-1",
      trigger_token: token,
    },
  )
  assert.equal(parseOrderReadRequest(null), null)
  assert.equal(
    parseOrderReadRequest({ work_id: 0, order_guid: "order-1", trigger_token: token }),
    null,
  )
  assert.equal(
    parseOrderReadRequest({
      work_id: "9223372036854775808",
      order_guid: "order-1",
      trigger_token: token,
    }),
    null,
  )
  assert.equal(
    parseOrderReadRequest({ work_id: 1, order_guid: " ", trigger_token: token }),
    null,
  )
  assert.equal(
    parseOrderReadRequest({ work_id: 1, order_guid: "order-1", trigger_token: "bad" }),
    null,
  )
  assert.equal(
    parseOrderReadRequest({
      work_id: 1,
      order_guid: "order-1",
      trigger_token: token,
      extra: true,
    }),
    null,
  )
})
