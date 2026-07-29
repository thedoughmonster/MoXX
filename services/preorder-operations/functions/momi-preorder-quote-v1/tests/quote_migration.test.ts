import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration pins quote authority and business boundaries", async () => {
  const sql = await readFile(
    new URL(
      "../../../../../supabase/migrations/20260729203650_add_preorder_quote_authority.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /^-- service-owner: preorder-operations/m);
  assert.match(sql, /create table momi_preorder\.quotes/);
  assert.match(sql, /command_id uuid not null unique/);
  assert.match(sql, /generate_series\(v_today, v_today \+ 13/);
  assert.match(sql, /minimum_days'\)::integer <= v_window\.fulfillment_date/);
  assert.match(sql, /greatest\(v_item\.price_floor_minor/);
  assert.match(sql, /v_final_unit >= v_item\.shop_price_minor/);
  assert.match(sql, /capacity_unavailable/);
  assert.match(sql, /allergen_unverified/);
  assert.match(sql, /request_snapshot is distinct from p_request/);
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i);
});
