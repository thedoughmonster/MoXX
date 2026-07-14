import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)

test("moves shared runtime, order work, and alerting into MoMi ownership", async () => {
  const runtime = await readFile(new URL(
    "20260713070448_move_function_registry_to_momi_runtime.sql",
    migrations,
  ), "utf8")
  const orders = await readFile(new URL(
    "20260713070513_move_order_api_work_to_momi_orders.sql",
    migrations,
  ), "utf8")
  const alerting = await readFile(new URL(
    "20260713070520_move_alerting_to_momi.sql",
    migrations,
  ), "utf8")

  assert.match(runtime, /create schema momi_runtime/)
  assert.match(runtime, /set schema momi_runtime/)
  assert.match(orders, /create schema momi_orders/)
  assert.match(orders, /source_system text/)
  assert.match(orders, /source_version_id text/)
  assert.match(orders, /momi\.toast_orders\.get_by_id\.v1/)
  assert.match(orders, /update toast_hydration\.webhook_order_mappings/)
  assert.match(orders, /with \(security_invoker = true\)/)
  assert.match(alerting, /alter schema toast_alerting rename to momi_alerting/)
  assert.match(alerting, /'source_provenance'/)
  assert.match(alerting, /unique \(source_system, order_id, alert_kind\)/)
})

test("keeps the generic decision claim free of Toast storage dependencies", async () => {
  const claim = await readFile(new URL(
    "20260713070527_create_momi_order_alert_claim.sql",
    migrations,
  ), "utf8")
  const adapters = await readFile(new URL(
    "20260713070602_create_momi_alert_trigger_adapters.sql",
    migrations,
  ), "utf8")
  const slack = await readFile(new URL(
    "20260713070608_create_momi_slack_delivery_contract_and_trigger_adapter.sql",
    migrations,
  ), "utf8")
  const triggerUniqueness = await readFile(new URL(
    "20260713070853_enforce_durable_http_trigger_uniqueness.sql",
    migrations,
  ), "utf8")

  assert.match(claim, /momi_orders\.api_invocation_work/)
  assert.match(claim, /momi_alerting\.order_source_mappings/)
  assert.doesNotMatch(claim, /toast_raw|toast_hydration|toast_alerting/)
  assert.match(adapters, /momi\.orders\.alert\.evaluate\.v1/)
  assert.match(adapters, /momi-order-alert-worker-v1/)
  assert.match(slack, /momi\.slack\.order_alert\.deliver\.v1/)
  assert.match(triggerUniqueness, /'http', 'durable_http'/)
})

test("fans one alert out to each enabled destination", async () => {
  const routes = await readFile(new URL(
    "20260714064712_enable_order_alert_destination_fanout.sql",
    migrations,
  ), "utf8")
  const claim = await readFile(new URL(
    "20260714064723_update_order_alert_claim_destination_fanout.sql",
    migrations,
  ), "utf8")
  const index = await readFile(new URL(
    "20260714065124_cover_order_alert_candidate_route_fk.sql",
    migrations,
  ), "utf8")

  assert.match(routes,
    /primary key \(source_key, alert_kind, destination_key\)/)
  assert.match(routes,
    /foreign key \(source_key, alert_kind, destination_key\)/)
  assert.match(routes, /candidate\.destination_key, false/)
  assert.match(routes,
    /unique \(source_system, order_id, alert_kind, destination_key\)/)
  assert.match(claim, /rule_matches/)
  assert.match(claim, /deliveries/)
  assert.match(claim,
    /on conflict \(source_system, order_id, alert_kind, destination_key\)/)
  assert.match(index, /source_key, alert_kind, destination_key/)
})
