import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = new URL(
  "../supabase/migrations/20260805122000_derive_cron_history_provider_warning.sql",
  import.meta.url,
);
const sql = await readFile(migration, "utf8");

test("derives provider warning only from accepted resource stop thresholds", () => {
  assert.match(sql, /new\.cpu_pct >= 70/u);
  assert.match(sql, /new\.ram_pct >= 80/u);
  assert.match(sql, /new\.io_pct >= 60/u);
  assert.match(sql, /new\.allocated_disk_pct >= 80/u);
  assert.match(sql, /new\.swap_used_bytes > previous_swap_used_bytes/u);
  assert.doesNotMatch(sql, /metric_name|prometheus|provider_warning_metrics/iu);
});

test("derivation is automatic and compares only complete prior samples", () => {
  assert.match(sql, /before insert or update of/u);
  assert.match(sql, /sample\.source_complete/u);
  assert.match(sql, /order by sample\.source_observed_at desc[\s\S]+limit 1/u);
  assert.match(sql, /new\.provider_warning :=/u);
});
