import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseToastStockPayload } from "../src/parse_toast_stock_payload.ts"

const stockBody = JSON.stringify({
  timestamp: "2026-07-14T14:00:00.000Z",
  eventCategory: "stock",
  eventType: "low_quantity",
  guid: "11111111-1111-1111-1111-111111111111",
  details: {
    itemGuid: "22222222-2222-2222-2222-222222222222",
    restaurantGuid: "33333333-3333-3333-3333-333333333333",
    status: "QUANTITY",
    quantity: 5,
  },
})

test("accepts Toast stock webhook events", () => {
  assert.equal(parseToastStockPayload(stockBody)?.eventType, "low_quantity")
})

test("rejects non-stock webhook events", () => {
  const orderBody = stockBody.replace('"eventCategory":"stock"', '"eventCategory":"order"')

  assert.equal(parseToastStockPayload(orderBody), null)
})

test("stores raw stock events without downstream work", async () => {
  const directory = new URL("../src/", import.meta.url)
  const source = await readFile(new URL("store_raw_stock_event.ts", directory), "utf8")

  assert.match(source, /toast_raw\.stock_webhook_events/)
  assert.match(source, /on conflict \(\(payload ->> 'guid'\)\) do nothing/)
  assert.doesNotMatch(source, /api_invocation_work|hydration|alert/i)
})
