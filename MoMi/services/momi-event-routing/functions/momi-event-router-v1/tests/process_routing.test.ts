import assert from "node:assert/strict"
import test from "node:test"
import { processRouting } from "../src/process_routing.ts"
import type { RoutingInput, RoutingStore } from "../src/types.ts"

const primary: RoutingInput = {
  event_id: "11111111-1111-4111-8111-111111111111",
  capability_token: "22222222-2222-4222-8222-222222222222",
}
const extra: RoutingInput = {
  event_id: "33333333-3333-4333-8333-333333333333",
  capability_token: "44444444-4444-4444-8444-444444444444",
}

class FakeStore implements RoutingStore {
  claimed = true
  batch: RoutingInput[] = []
  routeErrors = new Set<string>()
  calls: string[] = []

  claimItem(eventId: string, token: string): Promise<boolean> {
    this.calls.push(`claim:${eventId}:${token}`)
    return Promise.resolve(this.claimed)
  }

  claimBatch(limit: number): Promise<RoutingInput[]> {
    this.calls.push(`batch:${limit}`)
    return Promise.resolve(this.batch)
  }

  routeEvent(eventId: string, token: string): Promise<number> {
    this.calls.push(`route:${eventId}:${token}`)
    if (this.routeErrors.has(eventId)) return Promise.reject(new Error("down"))
    return Promise.resolve(1)
  }

  failRouting(eventId: string, token: string, error: string): Promise<boolean> {
    this.calls.push(`fail:${eventId}:${token}:${error}`)
    return Promise.resolve(true)
  }
}

test("routes one exact wake and a capability-isolated batch", async () => {
  const store = new FakeStore()
  store.batch = [extra]
  const result = await processRouting(primary, store)
  assert.equal(result.body.disposition, "routed")
  assert.equal(result.body.delivery_count, 1)
  assert.deepEqual(store.calls, [
    `claim:${primary.event_id}:${primary.capability_token}`,
    `route:${primary.event_id}:${primary.capability_token}`,
    "batch:49",
    `route:${extra.event_id}:${extra.capability_token}`,
  ])
})

test("does not batch behind a duplicate or failed exact wake", async () => {
  const duplicateStore = new FakeStore()
  duplicateStore.claimed = false
  const duplicate = await processRouting(primary, duplicateStore)
  assert.equal(duplicate.body.disposition, "duplicate")
  assert.equal(duplicateStore.calls.length, 1)

  const failedStore = new FakeStore()
  failedStore.routeErrors.add(primary.event_id)
  const failed = await processRouting(primary, failedStore)
  assert.equal(failed.body.disposition, "retrying")
  assert.equal(failedStore.calls.includes("batch:49"), false)
})

test("isolates an additional event failure and continues", async () => {
  const store = new FakeStore()
  const finalExtra = { ...extra, event_id: "55555555-5555-4555-8555-555555555555" }
  store.batch = [extra, finalExtra]
  store.routeErrors.add(extra.event_id)
  const result = await processRouting(primary, store)
  assert.equal(result.body.disposition, "routed")
  assert.ok(store.calls.some((call) => call.startsWith(`fail:${extra.event_id}:`)))
  assert.ok(store.calls.some((call) => call.startsWith(`route:${finalExtra.event_id}:`)))
})
