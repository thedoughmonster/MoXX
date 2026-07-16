import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../../../supabase/migrations/", import.meta.url)

test("creates a channel-neutral immutable communication archive", async () => {
  const sql = await readFile(new URL(
    "20260716164639_create_communications_archive.sql",
    migrations,
  ), "utf8")

  assert.match(sql, /-- service-owner: communications-archive/)
  assert.match(sql, /create schema if not exists momi_communications/)
  assert.match(sql, /create table momi_communications\.source_types/)
  assert.match(sql, /create table momi_communications\.source_accounts/)
  assert.match(sql, /create table momi_communications\.archive_items/)
  assert.match(sql, /source_account_key text not null/)
  assert.match(sql, /source_user_key text not null/)
  assert.match(sql, /source_conversation_key text not null/)
  assert.match(sql, /source_message_key text not null/)
  assert.match(sql, /sender_role text not null/)
  assert.match(sql, /payload jsonb not null/)
  assert.match(sql, /constraint archive_items_source_identity_unique unique/)
  assert.match(sql, /constraint archive_items_idempotency_unique unique/)
  assert.match(sql, /source_type, source_account_key, source_user_key, idempotency_key/)
})

test("keeps evaluations, corrections, derived records, and audit separate", async () => {
  const sql = await readFile(new URL(
    "20260716164642_create_communications_separation_records.sql",
    migrations,
  ), "utf8")

  assert.match(sql, /create table momi_communications\.derived_records/)
  assert.match(sql, /create table momi_communications\.corrections/)
  assert.match(sql, /create table momi_communications\.audit_events/)
  assert.match(sql, /create function momi_communications\.reject_archive_item_mutation/)
  assert.match(sql, /preserve_communication_archive_items/)
  assert.match(sql, /preserve_communication_evaluations/)
  assert.match(sql, /preserve_communication_derived_records/)
  assert.match(sql, /preserve_communication_corrections/)
  assert.match(sql, /preserve_communication_audit_events/)
  assert.doesNotMatch(sql, /before update or delete on momi_communications\.evaluation_jobs/)
})

test("captures OpenAI messages through an idempotent structured RPC", async () => {
  const sql = await readFile(new URL(
    "20260716164644_create_communications_capture_rpc.sql",
    migrations,
  ), "utf8")

  assert.match(sql, /capture_openai_message_v1/)
  assert.match(sql, /security invoker/)
  assert.match(sql, /set search_path = ''/)
  assert.match(sql, /extensions\.digest/)
  assert.match(sql, /jsonb_build_array/)
  assert.match(sql, /source_type = 'openai'/)
  assert.match(sql, /on conflict \(source_type, source_account_key\) do nothing/)
  assert.match(sql, /on conflict do nothing/)
  assert.match(sql, /insert into momi_communications\.evaluation_jobs/)
  assert.match(sql, /insert into momi_communications\.audit_events/)
  assert.match(sql, /OpenAI communication replay conflicts with archive/)
  assert.match(sql, /idempotency_item_id <> source_item_id/)
})

test("locks down direct table access and exposes only the service role RPC", async () => {
  const sql = await readFile(new URL(
    "20260716164646_grant_communications_archive_access.sql",
    migrations,
  ), "utf8")

  assert.match(sql, /'openai'/)
  assert.match(sql, /alter table momi_communications\.archive_items enable row level security/)
  assert.match(sql, /alter table momi_communications\.evaluation_jobs enable row level security/)
  assert.match(sql, /archive_items_source_account_idx/)
  assert.match(sql, /communication_evaluations_job_idx/)
  assert.match(sql, /corrections_derived_idx/)
  assert.match(sql, /audit_events_source_account_idx/)
  assert.match(sql, /revoke all on schema momi_communications from public, anon, authenticated/)
  assert.match(sql, /revoke all on all tables in schema momi_communications/)
  assert.match(sql, /grant execute on function momi_communications\.capture_openai_message_v1/)
  assert.match(sql, /to service_role/)
  assert.doesNotMatch(sql, /grant .* on all tables in schema momi_communications to authenticated/)
})
