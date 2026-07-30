import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration keeps lifecycle idempotent, private, and recoverable", async () => {
  const sql = await readFile(new URL(
    "../../../../../supabase/migrations/20260729211630_add_preorder_intent_lifecycle.sql",
    import.meta.url,
  ), "utf8");
  assert.match(sql, /^-- service-owner: preorder-operations/m);
  assert.match(sql, /create table momi_preorder\.checkout_holds/);
  assert.match(sql, /create table momi_preorder\.orders/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /request_digest text not null/);
  assert.match(sql, /recovery_authority_v1/);
  assert.match(sql, /v_response - 'recovery_authority'/);
  assert.match(sql, /enable row level security/g);
  assert.doesNotMatch(sql, /request_snapshot jsonb not null/);
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i);
});
