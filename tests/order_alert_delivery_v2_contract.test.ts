import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("..", import.meta.url)

test("declares and fences the warehouse-owned delivery binding", async () => {
  const paths = [
    "services/warehouse-read-api/service.json",
    "services/order-alerting/service.json",
    "supabase/migrations/20260824141117_add_order_alert_delivery_v2_binding.sql",
    "supabase/migrations/20260824141122_issue_order_alert_delivery_v2_bindings.sql",
    "supabase/migrations/20260824141129_route_order_reads_through_delivery_v2.sql",
    "services/order-alerting/functions/momi-order-alert-worker-v1/src/issue_order_read_capability.ts",
    "services/warehouse-read-api/functions/momi-orders-get-by-id-v1/contracts/input.schema.json",
    "services/warehouse-read-api/functions/momi-orders-get-by-version-v1/contracts/input.schema.json",
    "docs/service-access-debt-baseline.json",
    "docs/decisions/0031-order-alert-delivery-binding-v2.md",
  ]
  const [providerText, consumerText, binding, producer, consumption, adapter,
    latestInputText, exactInputText, baselineText, decision] =
    await Promise.all(paths.map((path) => readFile(new URL(path, root), "utf8")))
  const provider = JSON.parse(providerText)
  const consumer = JSON.parse(consumerText)
  const latestInput = JSON.parse(latestInputText)
  const exactInput = JSON.parse(exactInputText)
  const baseline = JSON.parse(baselineText)
  const contract = "momi.order_alert_delivery.v2"

  assert.equal(provider.contracts.provides.filter(
    (key: string) => key === contract).length, 1)
  assert.deepEqual(consumer.contracts.consumes.filter(
    (item: { contract: string }) => item.contract === contract),
  [{ service: "warehouse-read-api", contract }])
  assert.deepEqual(provider.owned_dataset.public_routine_commands.filter(
    (item: { contract: string }) => item.contract === contract), [{
    contract, routine: "momi_api.bind_order_alert_delivery_v2",
  }])
  assert.ok(provider.owned_dataset.private_relations.includes(
    "momi_api.order_alert_delivery_bindings_v2"))

  assert.match(binding, /security definer[\s\S]*pg_current_xact_id\(\)::xid/)
  assert.match(binding, /binding_key = 'momi\.order_alert_delivery\.v1'/)
  assert.match(binding, /set binding_key = 'momi\.order_alert_delivery\.v2'/)
  assert.match(binding, /message_id > 0/)
  assert.match(binding, /enable row level security/)
  assert.match(binding, /to svc_order_alerting;/)
  assert.doesNotMatch(binding, /grant (select|insert|update|delete|all)/i)
  assert.doesNotMatch(binding, /grant execute[\s\S]*to (public|anon|authenticated|service_role)/i)

  assert.equal(producer.match(
    /from momi_alerting\.issue_order_read_capability\(/g)?.length, 1)
  assert.equal(producer.match(
    /select momi_api\.bind_order_alert_delivery_v2\(/g)?.length, 1)
  assert.match(producer, /into strict v_issued/)
  assert.match(producer, /v_bound is not true/)
  assert.doesNotMatch(producer, /raise[\s\S]{0,80}(capability_token|delivery_token)/i)
  assert.match(adapter, /issue_order_read_capability_v2/)

  assert.equal(consumption.match(
    /acquire_order_alert_delivery_witness_v1\(/g)?.length, 2)
  assert.match(consumption, /elsif v_capability\.binding_key <> 'unbound'/)
  assert.doesNotMatch(consumption,
    /momi_alerting\.|momi_orders\.|momi_events\.deliveries/)
  assert.match(consumption, /set consumed_at = statement_timestamp\(\)/)
  assert.match(consumption, /into strict v_witness_expiry/)

  assert.equal(latestInput.additionalProperties, false)
  assert.deepEqual(latestInput.required,
    ["work_id", "order_id", "capability_token"])
  assert.equal(exactInput.additionalProperties, false)
  assert.deepEqual(exactInput.required,
    ["work_id", "order_id", "order_version_id", "capability_token"])
  for (const schema of [latestInput, exactInput]) {
    assert.equal(schema.properties.event_id, undefined)
    assert.equal(schema.properties.message_id, undefined)
    assert.equal(schema.properties.delivery_token, undefined)
  }

  const removedSources = new Set([
    "sha256:7e182d2da6c44f54ae9942eee8986f7e9cc2d2703238319a0a40a8ca4a3315ef",
    "sha256:cc0e3daaf5596574dc1f60f2273b7b1b92357c7dacf63afb520210598d18c992",
  ])
  assert.equal(baseline.findings.filter((finding: any) =>
    removedSources.has(finding.evidence.sql_source_hash)).length, 0)
  assert.equal(baseline.findings.filter((finding: any) =>
    finding.evidence.sql_source_hash ===
      "sha256:840c3ae6fd3e075236af245ee18b994aee605f11d88ed22f8f11161203ada540"
  ).length, 4)
  assert.match(decision, /Status: accepted/)
  assert.match(decision, /public order-read v1 routes, schemas, responses/)
})
