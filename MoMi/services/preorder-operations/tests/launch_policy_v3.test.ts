import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260805135432_add_preorder_launch_policy_v3.sql",
  import.meta.url,
);

test("launch migration versions schedules and keeps private authority", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /^-- service-owner: preorder-operations/m);
  assert.match(sql, /configuration_pickup_schedule_days/);
  assert.match(sql, /schema_version in \(1, 2, 3\)/);
  assert.match(sql, /publication_mode in \('draft', 'active', 'inactive'\)/);
  assert.match(sql, /unique \(surface_id, policy_version, fulfillment_date\)/);
  assert.match(sql, /extract\(isodow from day\)::integer/);
  assert.match(sql, /day::date - schedule\.cutoff_days_before/);
  assert.match(sql, /w\.policy_version = s\.policy_version/);
  assert.match(sql, /policy_version = v_surface\.policy_version/);
  assert.match(sql, /alter table momi_preorder\.configuration_pickup_schedule_days\s+enable row level security/);
  assert.match(sql, /revoke all on momi_preorder\.configuration_pickup_schedule_days\s+from public, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /grant .*configuration_pickup_schedule_days/i);
});

test("launch migration narrows allergen rejection and permits equal comparison", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /drop constraint catalog_items_check/);
  assert.match(sql, /base_price_minor <= shop_price_minor/);
  assert.match(sql, /total_minor <= shop_comparison_minor/);
  assert.match(sql, /v_final_unit > v_item\.shop_price_minor/);
  assert.match(sql, /jsonb_array_length\(p_request->'avoided_allergens'\) > 0/);
  assert.match(sql, /jsonb_array_length\(v_quote\.request_snapshot->'avoided_allergens'\) > 0/g);
  assert.doesNotMatch(sql, /available\)[\s\S]{0,120}allergen_status' = 'unverified'/);
  assert.match(sql, /launch savings must remain disabled/);
});
