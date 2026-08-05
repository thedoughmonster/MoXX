import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260805081330_add_preorder_pricing_eligibility_policy.sql",
  import.meta.url,
);

test("pricing and eligibility policy stays versioned and fail closed", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /^-- service-owner: preorder-operations/m);
  assert.match(sql, /create table momi_preorder\.configuration_price_classes/);
  assert.match(sql, /schema_version' is distinct from '1'[\s\S]*and p_configuration->>'schema_version' is distinct from '2'/);
  assert.match(sql, /\(p_configuration->>'schema_version'\)::integer, v_mode/);
  assert.doesNotMatch(sql, /as \$\n|\n\$;\n/);
  assert.match(sql, /create_quote_v1\(p_request jsonb\)[\s\S]*as \$quote\$/);
  assert.match(sql, /end;\n\$quote\$;/);
  assert.match(sql, /create table momi_preorder\.configuration_item_policies/);
  assert.match(sql, /exactly one highest doughnut price class is required/);
  assert.match(sql, /preorder item price does not match its class/);
  assert.match(sql, /eligibility_mode in \(\s*'always', 'starts_on', 'ends_on', 'date_range'/);
  assert.match(sql, /alter table momi_preorder\.configuration_price_classes enable row level security/);
  assert.match(sql, /alter table momi_preorder\.configuration_item_policies enable row level security/);
  assert.match(sql, /revoke all on momi_preorder\.configuration_price_classes\s+from public, anon, authenticated, service_role/);
  assert.match(sql, /revoke all on momi_preorder\.configuration_item_policies\s+from public, anon, authenticated, service_role/);
  assert.match(sql, /momi_preorder\.item_eligible_on_v1\([\s\S]*v_window\.fulfillment_date\)/);
  assert.match(sql, /'available', i\.available and momi_preorder\.item_eligible_on_v1/);
  assert.doesNotMatch(sql, /grant .*configuration_(?:price_classes|item_policies)/i);
});
