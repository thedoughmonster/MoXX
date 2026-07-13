import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)

const readMigration = (name: string) =>
  readFile(new URL(name, migrations), "utf8")

test("derives readable Toast items and modifiers in an approved view", async () => {
  const source = await readMigration(
    "20260713080123_create_toast_order_alert_presentation_view.sql",
  )

  assert.match(source, /toast_order_alert_presentations_v1/)
  assert.match(source, /with \(security_invoker = true\)/)
  assert.match(source, /toast_raw\.orders/)
  assert.match(source, /'checks'/)
  assert.match(source, /'selections'/)
  assert.match(source, /'modifiers'/)
  assert.match(source, /'displayName'/)
  assert.match(source, /'presentation_version', 1/)
})

test("snapshots a generic presentation when an alert is claimed", async () => {
  const schema = await readMigration(
    "20260713080132_add_order_alert_presentation_snapshot.sql",
  )
  const claim = await readMigration(
    "20260713080146_update_order_alert_claim_presentation.sql",
  )

  assert.match(schema, /currency_code text/)
  assert.match(schema, /order_presentation jsonb/)
  assert.match(schema, /jsonb_typeof\(order_presentation\) = 'object'/)
  assert.match(claim, /input_order_presentation jsonb/)
  assert.match(claim, /source_label/)
  assert.match(claim, /currency_code/)
  assert.match(claim, /order_presentation/)
  assert.doesNotMatch(claim, /toast_raw|toast_hydration|toast_alerting/)
})

test("prepares Block Kit without sending an order GUID", async () => {
  const source = await readMigration(
    "20260713080437_fix_slack_order_alert_summary_newlines.sql",
  )

  assert.match(source, /'blocks'/)
  assert.match(source, /'header'/)
  assert.match(source, /'display_number'/)
  assert.match(source, /'items'/)
  assert.match(source, /'modifiers'/)
  assert.match(source, /'client_msg_id'/)
  assert.match(source, /format\(E'\*Items\*\\n%s'/)
  assert.doesNotMatch(source, /candidate\.order_id/)
})
