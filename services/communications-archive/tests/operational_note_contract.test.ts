import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../../", import.meta.url)
const migration = new URL(
  "supabase/migrations/20260716164649_create_communications_operational_note_capture.sql",
  root,
)
const replayMigration = new URL(
  "supabase/migrations/20260716173245_fix_operational_note_replay_timestamp.sql",
  root,
)
const contract = new URL(
  "services/communications-archive/contracts/operational-note-v1.schema.json",
  root,
)

test("publishes the strict plugin payload contract", async () => {
  const schema = JSON.parse(await readFile(contract, "utf8"))

  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, [
    "source_account_key",
    "source_user_key",
    "note_type",
    "summary",
  ])
  assert.deepEqual(schema.properties.confidence, {
    type: ["number", "null"],
    minimum: 0,
    maximum: 1,
  })
})

test("defines a strict operational-memory capture action", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /-- service-owner: communications-archive/)
  assert.match(sql, /capture_operational_note_v1\(p_note jsonb\)/)
  assert.match(sql, /security invoker set search_path = ''/)
  assert.match(sql, /p_note - array\[/)
  assert.match(sql, /Operational note contains unsupported fields/)
  assert.match(sql, /'decision', 'task', 'question', 'fact', 'idea', 'risk'/)
  assert.match(sql, /confidence_value < 0 or confidence_value > 1/)
})

test("archives a synthesis without pretending it is a raw turn", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /'record_kind', 'candidate_operational_memory'/)
  assert.match(sql, /'synthesis_scope', 'conversation_context'/)
  assert.match(sql, /'raw_turns_included', false/)
  assert.match(sql, /'provider', 'openai'/)
  assert.match(sql, /'assistant'/)
})

test("derives account-scoped identity and reuses immediate evaluation", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /account_key, user_key, conversation_key, note_payload::text/)
  assert.match(sql, /'operational-note:' \|\| capture_fingerprint/)
  assert.match(sql, /'operational-note:v1:' \|\| capture_fingerprint/)
  assert.match(sql, /momi_communications\.capture_openai_message_v1/)
  assert.doesNotMatch(sql, /insert into momi_communications\.archive_items/)
  assert.doesNotMatch(sql, /insert into momi_communications\.evaluation_jobs/)
})

test("keeps the plugin action private and RPC-only", async () => {
  const sql = await readFile(migration, "utf8")

  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function[\s\S]*to service_role/)
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/)
})

test("reuses the first occurrence time when an operational note is retried", async () => {
  const sql = await readFile(replayMigration, "utf8")

  assert.match(sql, /create or replace function momi_communications\.capture_operational_note_v1/)
  assert.match(sql, /note_occurred_at := nullif\(p_note ->> 'occurred_at', ''\)::timestamptz/)
  assert.match(sql, /if note_occurred_at is null then[\s\S]*select item\.occurred_at/)
  assert.match(sql, /item\.idempotency_key = 'operational-note:v1:' \|\| capture_fingerprint/)
  assert.match(sql, /'assistant', note_occurred_at/)
})
