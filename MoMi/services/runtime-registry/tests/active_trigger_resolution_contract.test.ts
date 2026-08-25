import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../supabase/migrations/20260817185342_add_runtime_trigger_resolution_contract.sql",
  import.meta.url,
)

test("declares the bounded runtime-registry read contract", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../service.json", import.meta.url), "utf8",
  ))
  const contract = "momi.runtime.active_trigger_resolution.v1"
  const routines = [
    "resolve_communications_evaluation_trigger_v1",
    "resolve_event_router_trigger_v1",
    "resolve_order_alert_reader_trigger_v1",
    "resolve_order_alert_worker_trigger_v1",
    "resolve_slack_order_delivery_trigger_v1",
    "resolve_warehouse_projection_trigger_v1",
  ]
  assert(manifest.contracts.provides.includes(contract))
  assert(manifest.owned_dataset.public_reads.includes(contract))
  assert.deepEqual(
    manifest.owned_dataset.public_routine_reads.map(
      (entry: { contract: string; routine: string }) => entry.contract,
    ),
    routines.map(() => contract),
  )
  assert.deepEqual(
    manifest.owned_dataset.public_routine_reads.map(
      (entry: { routine: string }) => entry.routine,
    ),
    routines.map((routine) => `momi_runtime.${routine}`),
  )
})

test("pins each fixed worker mapping and fail-closed resolver gate", async () => {
  const sql = await readFile(migrationUrl, "utf8")
  assert(sql.startsWith("-- service-owner: runtime-registry\n"))
  const mappings = [
    ["momi.communications.evaluate_item.v1", "momi.communications.evaluate_item.http.v1",
      "communications-evaluation", "coordinator",
      "/functions/v1/momi-communications-evaluate-item-v1", "durable.work_token.v1"],
    ["momi.events.route.v1", "momi.events.route.http.v1", "momi-event-routing",
      "coordinator", "/functions/v1/momi-event-router-v1", "durable.work_token.v1"],
    ["momi.orders.alert.evaluate.v1", "momi.orders.alert_worker.http.v1",
      "order-alerting", "action", "/functions/v1/momi-order-alert-worker-v1",
      "momi.order_alert.delivery_capability_or_work_token.v1"],
    ["momi.slack.order_alert.deliver.v1", "momi.slack.order_alert.http.v1",
      "slack-order-delivery", "action", "/functions/v1/slack-order-alert-delivery-v1",
      "durable.work_token.v1"],
    ["momi.warehouse_projection.toast.consume.v1", "momi.warehouse_projection.toast.http.v1",
      "warehouse-projection", "coordinator",
      "/functions/v1/momi-warehouse-projection-worker-v1", "durable.work_token.v1"],
  ]
  for (const mapping of mappings) for (const value of mapping) assert(sql.includes(value))
  assert.equal((sql.match(/function\.active/g) ?? []).length, 6)
  assert.equal((sql.match(/trigger\.active/g) ?? []).length, 6)
  assert.equal((sql.match(/select count\(\*\) from resolved/g) ?? []).length, 6)
  assert.equal((sql.match(/trigger\.owner_service = function\.owner_service/g) ?? []).length, 6)
  assert.equal((sql.match(/security definer set search_path = ''/g) ?? []).length, 6)
  assert.doesNotMatch(sql, /\bexecute\s+format\b|\binformation_schema\b/i)
})

test("keeps reader enumeration, legacy compatibility, and execution closed", async () => {
  const sql = await readFile(migrationUrl, "utf8")
  for (const value of [
    "momi.orders.get_by_id.v1", "momi.orders.get_by_id.http.v1",
    "/functions/v1/momi-orders-get-by-id-v1", "momi.orders.get_by_version.v1",
    "momi.orders.get_by_version.http.v1", "/functions/v1/momi-orders-get-by-version-v1",
    "momi.toast_orders.get_by_id.v1", "momi.toast_orders.get_by_id.http.v1",
    "/functions/v1/momi-toast-orders-get-by-id-v1", "durable.read_capability.v1",
    "durable.work_token.v1", "trigger.trigger_type = 'durable_http'",
    "trigger.route_path not like '//%'",
  ]) assert(sql.includes(value))
  const revocations = sql.match(
    /revoke all on function momi_runtime\.resolve_[\s\S]*?from public, anon, authenticated, service_role;/g,
  ) ?? []
  assert.equal(revocations.length, 6)
  const grants = sql.match(
    /grant execute on function momi_runtime\.resolve_[\s\S]*?to svc_[a-z_]+;/g,
  ) ?? []
  assert.equal(grants.length, 6)
  assert.doesNotMatch(sql, /grant usage on schema/i)
  for (const role of [
    "svc_communications_evaluation", "svc_momi_event_routing",
    "svc_order_alerting", "svc_slack_order_delivery",
    "svc_warehouse_projection",
  ]) assert(sql.includes(role))
  assert.doesNotMatch(sql, /\bto service_role\b/i)
  assert.match(sql, /set owner_service = 'slack-order-delivery'/)
  assert.match(sql, /set owner_service = 'toast-order-read-api'/)
})

test("Toast wake cutovers use deployment-owned routes without internal dependencies", async () => {
  const [acquisition, hydration] = await Promise.all([
    readFile(new URL(
      "../../../supabase/migrations/20260817185737_remove_toast_acquisition_trigger_adapter_private_runtime_check.sql",
      import.meta.url,
    ), "utf8"),
    readFile(new URL(
      "../../../supabase/migrations/20260817185739_remove_toast_hydration_trigger_adapter_private_runtime_checks.sql",
      import.meta.url,
    ), "utf8"),
  ])
  assert.match(acquisition,
    /route_path constant text := '\/functions\/v1\/toast-data-acquisition-v1'/)
  assert.match(hydration,
    /route_path constant text := '\/functions\/v1\/toast-orders-fetch-by-guid-v1'/)
  assert.doesNotMatch(acquisition, /momi_runtime\./)
  assert.doesNotMatch(hydration, /momi_runtime\./)
})
