import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { runLegacyRecipePsql } from "./legacy_recipe_wsl_psql.ts"

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

const integrationEnabled = process.env.MOMI_EVENT_APPEND_PG_INTEGRATION === "1"
test("executes new/replay/conflict/invalid and two-producer cases on PostgreSQL", {
  skip: integrationEnabled ? false : "set MOMI_EVENT_APPEND_PG_INTEGRATION=1",
}, async (context) => {
  const database = `momi_event_append_${process.pid}`
  context.after(() => runLegacyRecipePsql("postgres",
    `drop database if exists ${database} with (force);`))
  runLegacyRecipePsql("postgres", `
    do $$ begin
      if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
    end $$;
    drop database if exists ${database} with (force);
    create database ${database};
  `)
  runLegacyRecipePsql(database, `
    create schema extensions; create extension pgcrypto with schema extensions;
    create schema momi_events;
    create table momi_events.events (
      event_id uuid primary key default extensions.gen_random_uuid(),
      event_name text not null, occurred_at timestamptz not null,
      schema_version integer not null, idempotency_key text not null unique,
      source_system text, source_resource_type text, source_id text,
      source_reference jsonb, correlation_id uuid not null
    );
    ${routerMigration}
  `)
  runLegacyRecipePsql(database, `
    do $test$
    declare
      first_id uuid; replay_id uuid; resource_id uuid;
      at_time timestamptz := '2026-07-21T00:00:00Z';
      correlation uuid := 'c03fbd6e-65b7-4b23-8e65-2e5a8ec00123';
    begin
      select event_id into first_id from momi_events.append_event_v1(
        'source.toast.webhook.orders.observed', 1, 'webhook:1', at_time,
        'toast', 'webhook_event', '1', '{"table":"webhook_events"}', correlation);
      select event_id into replay_id from momi_events.append_event_v1(
        'source.toast.webhook.orders.observed', 1, 'webhook:1', at_time,
        'toast', 'webhook_event', '1', '{"table":"webhook_events"}', correlation);
      if replay_id <> first_id then raise exception 'replay changed identity'; end if;
      begin
        perform * from momi_events.append_event_v1(
          'source.toast.webhook.stock.observed', 1, 'webhook:1', at_time,
          'toast', 'webhook_event', '1', '{"table":"webhook_events"}', correlation);
        raise exception 'conflict accepted';
      exception when unique_violation then null; end;
      begin
        perform * from momi_events.append_event_v1(
          'invalid', 1, 'invalid:1', at_time, 'toast', 'event', '2', '{}', correlation);
        raise exception 'invalid input accepted';
      exception when invalid_parameter_value then null; end;
      select event_id into resource_id from momi_events.append_event_v1(
        'source.toast.resource.menu.observed', 1, 'resource:1', at_time,
        'toast', 'resource_observation', '2', '{"table":"resource_observations"}', correlation);
      if resource_id is null or (select count(*) from momi_events.events) <> 2 then
        raise exception 'two-producer append failed';
      end if;
    end $test$;
  `)
})
