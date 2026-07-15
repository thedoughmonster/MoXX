import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { subscriptionKey } from "../src/types.ts"

const readSource = (name: string) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8")

test("uses one capability-bound event delivery lifecycle", () => {
  const begin = readSource("begin_delivery.ts")
  const acknowledge = readSource("ack_delivery.ts")
  const failure = readSource("fail_delivery.ts")
  const wake = readSource("wake_next_delivery.ts")
  assert.equal(subscriptionKey, "warehouse-projection-toast-v1")
  assert.match(begin, /momi_events\.begin_delivery/)
  assert.match(begin, /capabilityToken.*::uuid/s)
  assert.match(acknowledge, /momi_events\.ack_delivery/)
  assert.match(acknowledge, /capabilityToken.*::uuid/s)
  assert.match(failure, /momi_events\.fail_delivery/)
  assert.match(failure, /capabilityToken.*::uuid/s)
  assert.match(wake, /warehouse_projection\.wake_next_delivery/)
})

test("queries the source event and invokes only the database projector", () => {
  const sourceEvent = readSource("read_source_event.ts")
  const projector = readSource("project_toast_event.ts")
  const process = readSource("process_delivery.ts")
  const runtime = [
    sourceEvent,
    projector,
    process,
    readSource("handle_request.ts"),
  ].join("\n")
  assert.match(sourceEvent, /momi_events\.events/)
  assert.match(projector, /warehouse_projection\.project_toast_event/)
  assert.ok(process.indexOf("beginDelivery") <
    process.indexOf("readSourceEvent"))
  assert.ok(process.indexOf("readSourceEvent") <
    process.indexOf("projectToastEvent"))
  assert.doesNotMatch(runtime, /\bfetch\s*\(/)
  assert.doesNotMatch(runtime, /TOAST_[A-Z_]+/)
  assert.doesNotMatch(runtime, /pgmq\.read|read[B]atch|batch[_]size|wake[_]token/)
})

test("continues through one exact advisory-locked delivery", () => {
  const migrations = new URL(
    "../../../../../supabase/migrations/", import.meta.url,
  )
  const name = readdirSync(migrations).find((candidate) =>
    candidate.endsWith("_chain_projection_delivery_wakeups.sql"))
  assert.ok(name)
  const source = readFileSync(new URL(name, migrations), "utf8")
  assert.match(source, /pg_advisory_xact_lock\(19482, 1\)/)
  assert.match(source, /status = 'running'[\s\S]*lease_expires_at > now\(\)/)
  assert.match(source, /status = 'queued'[\s\S]*limit 1 for update skip locked/)
  assert.match(source, /set capability_token = gen_random_uuid\(\)/)
  assert.match(source, /select warehouse_projection\.wake_next_delivery\(\)/)
  assert.doesNotMatch(source, /batch[_ ]size|limit [2-9][0-9]*/i)
})

test("adapter wakes and core reclaims only an exact tokenized delivery", () => {
  const migrations = new URL(
    "../../../../../supabase/migrations/", import.meta.url,
  )
  const names = readdirSync(migrations)
  const adapterName = names.find((name) =>
    name.endsWith("_create_exact_projection_delivery_trigger_adapter.sql"))
  const earlyAdapterName = names.find((name) =>
    name.endsWith("_create_warehouse_projection_trigger_adapter.sql"))
  const registrationName = names.find((name) =>
    name.endsWith("_register_warehouse_projection_function.sql"))
  const rotationName = names.find((name) =>
    name.endsWith("_reclaim_projection_delivery_leases.sql"))
  const coreName = names.find((name) =>
    name.endsWith("_add_event_delivery_capabilities.sql"))
  const lifecycleName = names.find((name) =>
    name.endsWith("_create_momi_event_retry_functions.sql"))
  const reclaimName = names.find((name) =>
    name.endsWith("_reconcile_expired_event_deliveries.sql"))
  assert.ok(adapterName && earlyAdapterName && registrationName &&
    rotationName && coreName && lifecycleName && reclaimName)
  const adapter = readFileSync(new URL(adapterName, migrations), "utf8")
  const earlyAdapter = readFileSync(
    new URL(earlyAdapterName, migrations), "utf8",
  )
  const registration = readFileSync(
    new URL(registrationName, migrations), "utf8",
  )
  const rotation = readFileSync(new URL(rotationName, migrations), "utf8")
  const core = readFileSync(new URL(coreName, migrations), "utf8")
  const lifecycle = readFileSync(new URL(lifecycleName, migrations), "utf8")
  const reclaim = readFileSync(new URL(reclaimName, migrations), "utf8")
  assert.match(adapter, /'event_id', new\.event_id/)
  assert.match(adapter, /'message_id', new\.queue_message_id::text/)
  assert.match(adapter, /'capability_token', new\.capability_token::text/)
  assert.doesNotMatch(adapter, /batch[_]size|wake[_]secret|internal[_]wake/i)
  assert.match(earlyAdapter, /'event_id', new\.event_id/)
  assert.match(earlyAdapter, /'message_id', new\.queue_message_id::text/)
  assert.match(earlyAdapter, /'capability_token', capability_token/)
  assert.doesNotMatch(earlyAdapter,
    /batch[_]size|wake[_](secret|token)|internal[_]wake/i)
  assert.match(registration, /'event_id', 'event_id'/)
  assert.match(registration, /'message_id', 'message_id'/)
  assert.match(registration, /'capability_token', 'capability_token'/)
  assert.match(rotation, /new\.capability_token := gen_random_uuid\(\)/)
  assert.match(core, /add column if not exists capability_token uuid/)
  assert.match(core, /Capability-fenced delivery lifecycle is incomplete/)
  assert.match(lifecycle, /attempt_count = attempt_count \+ 1/)
  assert.match(lifecycle,
    /status = 'running' and lease_expires_at <= now\(\)/)
  assert.match(reclaim,
    /status = 'queued'[\s\S]*capability_token = gen_random_uuid/)
})
