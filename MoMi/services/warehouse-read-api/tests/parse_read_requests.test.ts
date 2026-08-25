import assert from "node:assert/strict"
import test from "node:test"

import { parseEntityRead } from "../src/parse_entity_read.ts"
import { parseStockRead } from "../src/parse_stock_read.ts"

const entityId = "11111111-1111-4111-8111-111111111111"
const locationId = "22222222-2222-4222-8222-222222222222"
const token = "33333333-3333-4333-8333-333333333333"

test("entity reads accept only canonical identity and durable work", () => {
  assert.deepEqual(parseEntityRead({ work_id: "42", entity_id: entityId,
    capability_token: token }), { work_id: "42", entity_id: entityId,
    capability_token: token })
  assert.equal(parseEntityRead({ work_id: "42", entity_id: "source-id",
    capability_token: token }), null)
  assert.equal(parseEntityRead({ work_id: 42, entity_id: entityId,
    capability_token: token }), null)
  assert.equal(parseEntityRead({ work_id: "42", entity_id: entityId,
    capability_token: token, toast_guid: entityId }), null)
})

test("stock reads bind one canonical item and location pair", () => {
  assert.deepEqual(parseStockRead({ work_id: "7", item_id: entityId,
    location_id: locationId, capability_token: token }), {
    work_id: "7", item_id: entityId, location_id: locationId,
    capability_token: token,
  })
  assert.equal(parseStockRead({ work_id: "7", item_id: entityId,
    location_id: "location-1", capability_token: token }), null)
  assert.equal(parseStockRead({ work_id: "9223372036854775808",
    item_id: entityId, location_id: locationId,
    capability_token: token }), null)
})
