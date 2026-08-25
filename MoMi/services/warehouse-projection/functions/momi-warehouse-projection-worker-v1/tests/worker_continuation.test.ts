import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { canContinueWorker } from "../src/can_continue_worker.ts"
import { runBackgroundContinuation } from
  "../src/run_background_continuation.ts"
import type { DeliveryTrigger } from "../src/types.ts"
import {
  capabilityToken,
  FakeStore,
  sourceEventFixture,
} from "./fake_store.ts"

const settings = {
  worker_max_runtime_seconds: 400,
  worker_max_deliveries: 500,
  handoff_reserve_seconds: 30,
  shutdown_margin_seconds: 10,
}

test("stops handoffs with projection and shutdown time remaining", () => {
  assert.equal(canContinueWorker(settings, 0, 359_999, 1), true)
  assert.equal(canContinueWorker(settings, 0, 360_000, 1), false)
  assert.equal(canContinueWorker(settings, 0, 0, 500), false)
})

test("continues through one exact reservation at a time", async () => {
  const firstId = "11111111-1111-4111-8111-111111111111"
  const secondId = "22222222-2222-4222-8222-222222222222"
  const first: DeliveryTrigger = {
    event_id: firstId, message_id: "2", capability_token: capabilityToken,
  }
  const second: DeliveryTrigger = {
    event_id: secondId, message_id: "3", capability_token: capabilityToken,
  }
  const store = new FakeStore()
  store.sourceEvents.set(firstId, { ...sourceEventFixture, event_id: firstId })
  store.sourceEvents.set(secondId, { ...sourceEventFixture, event_id: secondId })
  store.reservedTriggers.push(second)
  const originalInfo = console.info
  console.info = () => undefined
  await runBackgroundContinuation({
    trigger: first,
    settings,
    started_at_ms: Date.now(),
    completed_deliveries: 1,
  }, store).finally(() => { console.info = originalInfo })
  assert.deepEqual(store.calls, [
    "begin:2", `source:${firstId}`, `project:${firstId}`, "ack:2",
    "reserve:next",
    "begin:3", `source:${secondId}`, `project:${secondId}`, "ack:3",
    "reserve:next",
  ])
})

test("uses internal token rotation and a bounded worker envelope", () => {
  const migrations = new URL(
    "../../../../../supabase/migrations/", import.meta.url,
  )
  const sources = readdirSync(migrations)
    .filter((name) => name.includes("warehouse_projection"))
    .map((name) => readFileSync(new URL(name, migrations), "utf8"))
    .join("\n")
  const handler = readFileSync(
    new URL("../src/handle_request.ts", import.meta.url), "utf8",
  )
  assert.match(sources, /dispatch_mode in \('http', 'internal'\)/)
  assert.match(sources, /reserve_internal_delivery/)
  assert.match(sources, /v_token := gen_random_uuid\(\)/)
  assert.match(sources, /worker_max_runtime_seconds = 400/)
  assert.match(sources, /worker_max_deliveries = 500/)
  assert.match(handler, /EdgeRuntime\.waitUntil\(runBackgroundContinuation/)
})
