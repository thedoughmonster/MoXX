import assert from "node:assert/strict"
import test from "node:test"

import { matchWebhookContract } from "../src/match_webhook_contract.ts"

test("matches every shared-route subscription contract", () => {
  const cases = [
    ["order_updated", "order_updated", "orders"],
    ["channel_order_updated", "channel_order_updated", "orders"],
    ["stock", "in_stock", "stock"],
    ["stock", "low_quantity", "stock"],
    ["stock", "out_of_stock", "stock"],
    ["menus", "menus_updated", "menus"],
    ["packaging", "packaging_updated", "packaging"],
    ["partner", "packaging_updated", "packaging"],
    ["restaurant_availability", "availability_online", "restaurant-availability"],
    ["restaurant_availability", "availability_offline", "restaurant-availability"],
    [
      "restaurant_availability_toggle",
      "toggle_availability_online",
      "restaurant-availability",
    ],
    [
      "restaurant_availability_toggle",
      "toggle_availability_offline",
      "restaurant-availability",
    ],
    ["ordering_schedule", "ordering_schedule_updated", "ordering-schedule"],
  ] as const

  for (const [category, type, subscription] of cases) {
    assert.equal(
      matchWebhookContract(category, type)?.subscriptionKey,
      subscription,
    )
  }
})

test("rejects an unregistered webhook category", () => {
  assert.equal(matchWebhookContract("orders", "order_updated"), null)
  assert.equal(matchWebhookContract("restaurant", "availability_online"), null)
})

test("rejects an event type outside its registered category", () => {
  assert.equal(matchWebhookContract("menus", "packaging_updated"), null)
  assert.equal(
    matchWebhookContract("restaurant_availability", "toggle_availability_online"),
    null,
  )
})
