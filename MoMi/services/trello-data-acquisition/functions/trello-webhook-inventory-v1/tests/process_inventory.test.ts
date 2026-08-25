// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import test from "node:test"
import { processInventory } from "../src/process_inventory.ts"
import type { InventoryDependencies } from "../src/types.ts"

const jobId = "55555555-5555-4555-8555-555555555555"

test("returns the complete source response from durable inventory work", async () => {
  const dependencies: InventoryDependencies = {
    getSetting: () => "configured",
    claim: (work) => Promise.resolve({ ...work, boardId: "board-1" }),
    acquire: () => Promise.resolve({
      httpStatus: 200,
      headers: { "content-type": "application/json" },
      payload: [{ id: "hook-1" }],
      rawText: '[{"id":"hook-1"}]',
      errorCode: null,
    }),
    finish: () => Promise.resolve("succeeded"),
  }
  const response = await processInventory(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, capability_token: "fixture-capability" }),
  }), dependencies)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, "succeeded")
  assert.equal(body.source_response.raw_text, '[{"id":"hook-1"}]')
})

test("does not acquire for unavailable durable work", async () => {
  let acquisitionCalls = 0
  const dependencies: InventoryDependencies = {
    getSetting: () => "configured",
    claim: () => Promise.resolve(null),
    acquire() {
      acquisitionCalls += 1
      throw new Error("must not acquire")
    },
    finish: () => Promise.reject(new Error("must not finish")),
  }
  const response = await processInventory(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, capability_token: "fixture-capability" }),
  }), dependencies)

  assert.equal(response.status, 409)
  assert.equal(acquisitionCalls, 0)
})
