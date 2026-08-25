import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

test("locks projection and acknowledgement in one transaction", () => {
  const migrations = new URL(
    "../../../../../supabase/migrations/", import.meta.url,
  )
  const name = readdirSync(migrations).find((candidate) =>
    candidate.endsWith("_make_projection_acknowledgement_atomic.sql"))
  assert.ok(name)
  const source = readFileSync(new URL(name, migrations), "utf8")
  const locked = source.indexOf("for update")
  const projected = source.indexOf("project_toast_event")
  const acknowledged = source.indexOf("momi_events.ack_delivery")
  assert.ok(locked >= 0 && projected > locked && acknowledged > projected)
  assert.match(source, /status = 'running'/)
  assert.match(source, /lease_expires_at > now\(\)/)
  assert.match(source, /menu_refresh_enqueued.*publication_not_advanced/s)
  assert.match(source, /raise exception 'acknowledgement_failed'/)
})
