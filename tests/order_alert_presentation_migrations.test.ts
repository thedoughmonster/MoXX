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

test("prepares one fenced Slack ticket without an order GUID", async () => {
  const source = await readMigration(
    "20260714131109_format_compact_slack_order_tickets.sql",
  )

  assert.match(source, /'blocks'/)
  assert.match(source, /'section'/)
  assert.match(source, /E'```\\n%s\\n```'/)
  assert.match(source, /'display_number'/)
  assert.match(source, /'customer_label'/)
  assert.match(source, /CUSTOMER:/)
  assert.match(source, /then 'ITEM' else 'ITEMS'/)
  assert.match(source, /'items'/)
  assert.match(source, /'modifiers'/)
  assert.match(source, /'client_msg_id'/)
  assert.doesNotMatch(source, /'divider'|'header'|'container'/)
  assert.doesNotMatch(source, /candidate\.order_id/)
})

test("derives the optional customer label from stored Toast checks", async () => {
  const source = await readMigration(
    "20260714131101_add_toast_order_customer_label.sql",
  )

  assert.match(source, /toast_orders_by_id_v1/)
  assert.match(source, /tabName/)
  assert.match(source, /customer_label/)
  assert.match(source, /toast_order_source_versions_v1/)
  assert.doesNotMatch(source, /toast_raw|http|fetch/)
})
