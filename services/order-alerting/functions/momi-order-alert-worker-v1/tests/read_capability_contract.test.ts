import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../../../..", import.meta.url)
const read = (path: string) => readFile(new URL(path, root), "utf8")

test("canonical reads use one attempt-bound short-lived capability", async () => {
  const [migration, consumption, issueAdapter, revokeAdapter, execution, claim] =
    await Promise.all([
      read("supabase/migrations/20260715055644_issue_order_alert_read_capabilities.sql"),
      read("supabase/migrations/20260715064305_consume_order_read_capabilities.sql"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/issue_order_read_capability.ts"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/revoke_order_read_capability.ts"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/execute_work.ts"),
      read("services/order-alerting/functions/momi-order-alert-worker-v1/src/claim_work.ts"),
    ])
  assert.match(migration, /^-- service-owner: order-alerting$/m)
  assert.match(migration, /join momi_alerting\.order_event_bridges/)
  assert.match(migration, /bridge\.event_name = 'warehouse\.order\.observed'/)
  assert.match(migration, /attempt\.invocation_id = p_invocation_id/)
  assert.match(migration,
    /delivery\.capability_token = p_delivery_capability_token/)
  assert.match(migration, /delivery\.status = 'running'/)
  assert.match(migration, /now\(\) \+ interval '30 seconds'/)
  assert.match(migration, /delivery\.lease_expires_at/)
  assert.match(migration, /function_key, subject_entity_id, binding_key, expires_at/)
  assert.match(migration, /momi\.order_alert_delivery\.v1/)
  assert.match(migration, /event_id, queue_message_id/)
  assert.match(migration, /revoke_order_read_capability/)
  const audit = migration.match(
    /create table momi_alerting\.order_read_capability_uses \(([\s\S]*?)\);/,
  )?.[1] ?? ""
  assert.doesNotMatch(audit, /capability_token/)
  assert.match(consumption, /set consumed_at = now\(\)/)
  assert.match(consumption, /binding\.queue_message_id/)
  assert.match(consumption, /delivery\.status = 'running'/)
  assert.match(consumption, /attempt\.outcome = 'running'/)
  assert.match(issueAdapter, /issue_order_read_capability/)
  assert.match(revokeAdapter, /revoke_order_read_capability/)
  assert.match(execution, /issueOrderReadCapability/)
  assert.match(execution, /finally \{/)
  assert.match(execution, /revokeOrderReadCapability/)
  assert.match(claim, /durable\.read_capability\.v1/)
  assert.match(claim, /exactOrderContractKey/)
  assert.match(claim, /latestOrderContractKey/)
  assert.match(execution, /exactOrderContractKey/)
  assert.match(execution, /latestOrderContractKey/)
  assert.match(claim, /durable\.work_token\.v1/)
})

test("changed alert manifest hashes are registered", async () => {
  const [manifest, eventRegistration, wakeRegistration] = await Promise.all([
    read("services/order-alerting/functions/momi-order-alert-worker-v1/function.json"),
    read("supabase/migrations/20260714185919_add_order_alert_event_trigger_adapter.sql"),
    read("supabase/migrations/20260714193531_secure_order_alert_delivery_trigger_adapter.sql"),
  ])
  const hash = createHash("sha256").update(manifest).digest("hex")
  assert.match(eventRegistration, new RegExp(hash))
  assert.match(wakeRegistration, new RegExp(hash))
  const parsed = JSON.parse(manifest) as {
    required_capabilities: string[]
    declared_side_effects: string[]
  }
  assert.ok(parsed.required_capabilities.includes(
    "canonical_read_capability_manage"))
  assert.ok(parsed.declared_side_effects.includes(
    "issues_exact_canonical_read_capability"))
  assert.ok(parsed.declared_side_effects.includes(
    "revokes_exact_canonical_read_capability"))
})
