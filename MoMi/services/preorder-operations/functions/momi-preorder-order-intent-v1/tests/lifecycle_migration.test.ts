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
  assert.match(sql, /create table momi_preorder\.public_request_rate_buckets/);
  assert.match(sql, /create table momi_preorder\.orders/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /request_digest text not null/);
  assert.match(sql, /recovery_authority_v1/);
  assert.match(sql, /admit_public_request_v1/);
  assert.match(sql, /policy_snapshot jsonb not null/);
  assert.match(sql, /v_surface\.catalog_version <> v_quote\.catalog_version/);
  assert.match(sql, /item\.allergen_status = 'unverified'/);
  assert.match(sql, /v_hold\.hold_status = 'consumed'/);
  assert.match(sql, /v_order\.order_status in \('awaiting_payment', 'confirmed'\)/);
  assert.match(sql, /v_response - 'recovery_authority'/);
  assert.match(sql, /enable row level security/g);
  assert.doesNotMatch(sql, /request_snapshot jsonb not null/);
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i);
});

test("launch lifecycle revalidates avoidance without blocking general carts", async () => {
  const sql = await readFile(new URL(
    "../../../../../supabase/migrations/20260805135432_add_preorder_launch_policy_v3.sql",
    import.meta.url,
  ), "utf8");
  assert.equal(
    sql.match(/jsonb_array_length\(v_quote\.request_snapshot->'avoided_allergens'\) > 0/g)?.length,
    2,
  );
  assert.equal(
    sql.match(/item\.allergen_status in \('unverified', 'cross_contact_possible'\)/g)?.length,
    2,
  );
});
