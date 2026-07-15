import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../../../..", import.meta.url)
const read = (path: string) => readFile(new URL(path, root), "utf8")

test("uses one capability-fenced canonical delivery", async () => {
  const [stageAdapter, stageMigration, wakeMigration, activation,
    claim, coreCapability, begin, acknowledgement, failure] =
    await Promise.all([
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/stage_event_work.ts"),
      read("supabase/migrations/20260714193524_create_order_alert_delivery_claim.sql"),
      read("supabase/migrations/20260714193531_secure_order_alert_delivery_trigger_adapter.sql"),
      read("supabase/migrations/20260714185925_activate_live_order_alert_subscription.sql"),
      read("supabase/migrations/20260714185912_claim_canonical_order_alerts.sql"),
      read("supabase/migrations/20260714192524_add_event_delivery_capabilities.sql"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/begin_delivery.ts"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/ack_delivery.ts"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/fail_delivery.ts"),
    ])

  assert.match(stageMigration, /^-- service-owner: order-alerting$/m)
  assert.match(wakeMigration, /^-- service-owner: order-alerting$/m)
  assert.match(stageAdapter, /stage_order_event_work/)
  assert.match(stageAdapter, /trigger\.capability_token/)
  assert.doesNotMatch(stageAdapter, /pgmq|momi_events\.events/)
  assert.match(stageMigration,
    /delivery\.capability_token = p_capability_token/)
  assert.match(stageMigration,
    /target\.event_name <> 'warehouse\.order\.observed'/)
  assert.match(stageMigration, /'momi\.orders\.get_by_id\.v1'/)
  assert.doesNotMatch(stageMigration, /toast_raw|momi\.toast_orders/)

  assert.match(wakeMigration,
    /body := jsonb_build_object\(\s*'event_id', new\.event_id,\s*'message_id', new\.queue_message_id::text,\s*'capability_token', new\.capability_token\s*\)/)
  assert.doesNotMatch(wakeMigration,
    /pgmq\.read|dual_trigger|authorization/i)
  assert.match(coreCapability,
    /momi_events\.begin_delivery\(text,uuid,bigint,uuid\)/)
  assert.match(coreCapability,
    /momi_events\.ack_delivery\(text,uuid,bigint,uuid\)/)
  assert.match(coreCapability,
    /momi_events\.fail_delivery\(text,uuid,bigint,uuid,text\)/)
  for (const adapter of [begin, acknowledgement, failure]) {
    assert.match(adapter, /capabilityToken/)
    assert.match(adapter, /momi_events\.(begin_delivery|ack_delivery|fail_delivery)/)
  }

  assert.match(activation, /event_pattern = 'warehouse\.order\.observed'/)
  assert.doesNotMatch(activation, /event_pattern = 'warehouse\.order\.%'/)
  assert.match(activation, /active = false/)
  assert.match(activation,
    /stage_order_event_work\(uuid,bigint,uuid\)/)
  assert.match(claim,
    /coalesce\(bridge\.source_order_id, work\.order_id\)/)
  assert.match(claim,
    /on conflict \(source_system, order_id, alert_kind, destination_key\)/)
})
