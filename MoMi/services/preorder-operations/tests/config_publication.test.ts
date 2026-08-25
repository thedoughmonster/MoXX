import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260729183503_add_preorder_configuration_publication.sql",
  import.meta.url,
);

test("publication migration stays private, idempotent, and fail closed", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /^-- service-owner: preorder-operations/m);
  assert.match(sql, /config_digest text not null unique/);
  assert.match(sql, /'replayed', true/);
  assert.match(sql, /active preorder configuration must enable its surface/);
  assert.match(sql, /active preorder configuration lacks savings policy/);
  assert.match(sql, /active preorder configuration has unsafe available item/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(
    sql,
    /grant execute on function momi_preorder\.publish_configuration_v1\(jsonb, text, text\)\s+to service_role/,
  );
  assert.doesNotMatch(
    sql,
    /grant execute on function momi_preorder\.publish_configuration_v1[\s\S]*to (public|anon|authenticated)/i,
  );
});

test("bootstrap projection exposes price and allergen evidence", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const field of ["category", "shop_price", "price_floor", "allergens"]) {
    assert.match(sql, new RegExp(`'${field}'`));
  }
});
