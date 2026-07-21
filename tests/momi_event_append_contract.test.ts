import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const routerMigration = await readFile(new URL(
  "../supabase/migrations/20260721133123_create_event_append_contract.sql",
  import.meta.url,
), "utf8")
const producerMigration = await readFile(new URL(
  "../supabase/migrations/20260721133130_route_archive_events_through_append_contract.sql",
  import.meta.url,
), "utf8")
const routerManifest = JSON.parse(await readFile(new URL(
  "../services/momi-event-routing/service.json", import.meta.url,
), "utf8"))
const archiveManifest = JSON.parse(await readFile(new URL(
  "../services/communications-archive/service.json", import.meta.url,
), "utf8"))

test("event router owns exact append contract", () => {
  assert.equal(routerMigration.split("\n")[0], "-- service-owner: momi-event-routing")
  assert.match(routerMigration, /create function momi_events\.append_event_v1\(/)
  assert.match(routerMigration, /on conflict \(idempotency_key\) do nothing/)
  assert.match(routerMigration, /event append replay conflicts/)
  assert.match(routerMigration, /event append input is invalid/)
  assert.doesNotMatch(routerMigration, /route_event\(/)
  assert(routerManifest.contracts.provides.includes("momi.events.append.v1"))
  assert(routerManifest.owned_dataset.public_routine_commands.some(
    (entry: { contract: string; routine: string }) =>
      entry.contract === "momi.events.append.v1" &&
      entry.routine === "momi_events.append_event_v1",
  ))
})

test("archive producers use append without private event writes", () => {
  assert.equal(producerMigration.split("\n")[0], "-- service-owner: communications-archive")
  assert.match(producerMigration, /create or replace function momi_events\.emit_toast_webhook_event/)
  assert.match(producerMigration, /create or replace function momi_events\.emit_toast_resource_observation/)
  assert.equal((producerMigration.match(/momi_events\.append_event_v1\(/g) ?? []).length, 2)
  assert.doesNotMatch(producerMigration, /insert\s+into\s+momi_events\.events/i)
  assert(archiveManifest.contracts.consumes.some(
    (entry: { service: string; contract: string }) =>
      entry.service === "momi-event-routing" && entry.contract === "momi.events.append.v1",
  ))
})

test("producer mapping remains exact and payload-free", () => {
  for (const event of [
    "source.toast.webhook.orders.observed",
    "source.toast.webhook.stock.observed",
    "source.toast.resource.order.observed",
    "source.toast.resource.menu.observed",
  ]) assert.match(producerMigration, new RegExp(event.replaceAll(".", "\\.")))
  assert.match(producerMigration, /'table', 'webhook_events'/)
  assert.match(producerMigration, /'table', 'resource_observations'/)
  assert.doesNotMatch(producerMigration, /raw_body|payload/)
})
