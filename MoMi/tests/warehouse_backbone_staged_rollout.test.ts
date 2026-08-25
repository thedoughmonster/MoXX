import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import test from "node:test"

const migrationRoot = fileURLToPath(
  new URL("../supabase/migrations/", import.meta.url),
)
const stagedFiles = [
  "20260714182300_register_event_routing_function.sql",
  "20260714182302_register_warehouse_projection_function.sql",
  "20260714182304_register_toast_acquisition_function.sql",
]
const readerFiles = [
  "20260714174941_register_warehouse_reader_contracts.sql",
  "20260714190933_register_warehouse_read_routes_v2.sql",
]
const cronFiles = [
  ["20260714175723_schedule_warehouse_backbone_reconciliation.sql",
    "momi-toast-acquisition-due-v1"],
  ["20260714182308_create_event_routing_trigger_adapter.sql",
    "momi-event-routing-wakeup-v1"],
  ["20260714182310_create_toast_acquisition_trigger_adapter.sql",
    "momi-toast-acquisition-wakeup-v1"],
  ["20260714183316_create_warehouse_projection_trigger_adapter.sql",
    "momi-warehouse-projection-wakeup-v1"],
  ["20260714192132_reconcile_expired_event_deliveries.sql",
    "momi-expired-delivery-reconcile-v1"],
  ["20260714192250_schedule_momi_event_delivery_retries.sql",
    "momi-event-delivery-retries-v1"],
  ["20260714193531_secure_order_alert_delivery_trigger_adapter.sql",
    "momi-order-alert-event-wakeup-v1"],
] as const

test("stages outbound workers inactive until hosted verification", async () => {
  for (const file of stagedFiles) {
    const sql = await readFile(`${migrationRoot}/${file}`, "utf8")
    assert.match(sql, /function_type, active,[\s\S]*false,/)
    assert.match(sql, /authentication_policy_key,[\s\S]*false,/)
    assert.doesNotMatch(sql, /authentication_policy_key,[\s\S]*true,/)
  }

  const subscriptions = await readFile(
    `${migrationRoot}/20260714174828_create_momi_event_deliveries.sql`,
    "utf8",
  )
  const alertCutover = await readFile(
    `${migrationRoot}/20260714185925_activate_live_order_alert_subscription.sql`,
    "utf8",
  )
  assert.match(
    subscriptions,
    /warehouse-projection-toast-v1[\s\S]*dead_letter', false, '-infinity'/,
  )
  assert.match(
    subscriptions,
    /order-alerting-v1[\s\S]*dead_letter', false, 'infinity'/,
  )
  const lifecycle = await readFile(
    `${migrationRoot}/20260714175720_create_momi_event_delivery_lifecycle.sql`,
    "utf8",
  )
  assert.match(lifecycle, /source_event\.recorded_at >= minimum_recorded_at/)
  assert.doesNotMatch(lifecycle, /source_event\.occurred_at >= minimum_/)
  assert.match(alertCutover, /event_pattern = 'warehouse\.order\.observed',[\s\S]*active = false/)
  assert.doesNotMatch(alertCutover, /active = true/)
})

test("stages canonical readers inactive until their functions are hosted", async () => {
  for (const file of readerFiles) {
    const sql = await readFile(`${migrationRoot}/${file}`, "utf8")
    assert.doesNotMatch(sql, /'read', true/)
    assert.doesNotMatch(sql, /'durable\.[^']+', true, 'warehouse-read-api'/)
    assert.match(sql, /'read', false/)
    assert.match(sql, /'durable\.[^']+', false, 'warehouse-read-api'/)
  }
})

test("creates every warehouse backbone cron job inactive", async () => {
  for (const [file, jobName] of cronFiles) {
    const sql = await readFile(`${migrationRoot}/${file}`, "utf8")
    assert.match(sql, new RegExp(`cron\\.schedule\\([\\s\\S]*'${jobName}'`))
    assert.match(sql, new RegExp(
      `cron\\.alter_job\\(jobid, active := false\\)[^;]*jobname = '${jobName}'`,
    ))
  }
})
