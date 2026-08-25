import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

const migrations = new URL(
  "../../../../../supabase/migrations/",
  import.meta.url,
)

test("completes only unsubscribed canonical replay routing work", () => {
  const name = readdirSync(migrations).find((entry) =>
    entry.endsWith("_complete_unsubscribed_canonical_replay_routing.sql")
  )
  assert.ok(name)
  const sql = readFileSync(new URL(name, migrations), "utf8")
  assert.match(sql, /warehouse:canonical-resource-v2:%/)
  assert.match(sql, /event\.event_name like 'warehouse\.%\.reconciled'/)
  assert.match(sql, /work\.status in \('pending', 'retry_wait'\)/)
  assert.match(sql,
    /not exists \([\s\S]*momi_events\.subscriptions[\s\S]*subscription\.active/)
  assert.match(sql,
    /event\.recorded_at >= subscription\.minimum_recorded_at/)
  assert.match(sql, /event\.event_name like subscription\.event_pattern/)
  assert.match(sql,
    /not exists \([\s\S]*momi_events\.deliveries[\s\S]*delivery\.event_id/)
  assert.doesNotMatch(sql, /work\.status in \([^)]*'running'/)
})
