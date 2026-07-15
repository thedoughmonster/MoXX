import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = (name: string) => readFile(new URL(
  `../../../../../supabase/migrations/${name}`,
  import.meta.url,
), "utf8")

test("routing wakeup reclaims expired leases and caps attempts", async () => {
  const source = await migration(
    "20260714182308_create_event_routing_trigger_adapter.sql",
  )
  assert.match(source, /status = 'running' and lease_expires_at <= now\(\)/)
  assert.match(source, /attempt_count >= 12 then 'dead_letter'/)
  assert.match(source, /lease_expires_at = null/)
})

test("delivery acknowledgement validates before queue deletion", async () => {
  const source = await migration(
    "20260714175720_create_momi_event_delivery_lifecycle.sql",
  )
  const lock = source.indexOf("for update of delivery")
  const deletion = source.indexOf("pgmq.delete")
  assert.ok(lock >= 0 && deletion > lock)
  assert.match(source, /delivery\.queue_message_id = p_message_id/)
  assert.match(source, /delivery\.status = 'running'/)
})

test("delivery claims count crashes and expired leases are reconciled", async () => {
  const lifecycle = await migration(
    "20260714180028_create_momi_event_retry_functions.sql",
  )
  const reconciliation = await migration(
    "20260714192132_reconcile_expired_event_deliveries.sql",
  )
  assert.match(lifecycle, /attempt_count = attempt_count \+ 1/)
  assert.match(lifecycle, /status = 'running'.*lease_expires_at <= now\(\)/s)
  assert.match(reconciliation, /attempt_count >= 12/)
  assert.match(reconciliation, /status = 'dead_letter'/)
  assert.match(reconciliation, /status = 'queued'/)
  assert.match(reconciliation, /'15 seconds'/)
})
