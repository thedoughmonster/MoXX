import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = new URL(
  "../supabase/migrations/20260805081324_govern_cron_history_retention_trigger_adapter.sql",
  import.meta.url,
);
const sql = await readFile(migration, "utf8");

test("pins the accepted retention and incomplete-row boundaries", () => {
  assert.match(sql, /raw_retention interval[^;]+interval '7 days'/su);
  assert.match(sql, /summary_retention interval[^;]+interval '90 days'/su);
  assert.match(sql, /exception_retention interval[^;]+interval '365 days'/su);
  assert.match(sql, /slow_run_threshold interval[^;]+interval '3 seconds'/su);
  assert.match(
    sql,
    /raw\.end_time is null[\s\S]+status in \('connecting', 'running'\)/u,
  );
  assert.match(
    sql,
    /raw\.runid > cursor_before[\s\S]+order by raw\.runid[\s\S]+limit p_limit/u,
  );
});

test("requires exact durable coverage before raw deletion", () => {
  const summaryCoverage = sql.indexOf(
    "insert into momi_cron_history.batch_summary_coverage",
  );
  const exceptionCoverage = sql.indexOf(
    "insert into momi_cron_history.exception_ledger",
  );
  const rawDelete = sql.indexOf("delete from cron.job_run_details raw using");
  assert.ok(summaryCoverage > 0 && summaryCoverage < rawDelete);
  assert.ok(
    exceptionCoverage > summaryCoverage && exceptionCoverage < rawDelete,
  );
  assert.match(sql, /summary coverage mismatch/u);
  assert.match(sql, /exception coverage mismatch/u);
  assert.match(sql, /raw deletion readback mismatch/u);
});

test("preserves failure, recovery, slow, unknown, declared, and held rows", () => {
  for (
    const reason of [
      "failed",
      "recovery_after_failure",
      "slow",
      "unexpected_status",
      "unexpected_return",
      "unexpected_timing",
      "declared_retry",
      "declared_exception",
    ]
  ) assert.match(sql, new RegExp(reason, "u"));
  assert.match(sql, /not candidates\.held/u);
  assert.match(sql, /released_at is null/u);
  assert.doesNotMatch(
    sql.match(
      /create table momi_cron_history\.minute_summaries \([\s\S]*?\n\);/u,
    )?.[0] ?? "",
    /command|return_message/u,
  );
  assert.doesNotMatch(
    sql.match(
      /create table momi_cron_history\.exception_ledger \([\s\S]*?\n\);/u,
    )?.[0] ?? "",
    /command|return_message/u,
  );
});

test("enforces the single-writer resource and progression governor", () => {
  assert.match(sql, /pg_try_advisory_xact_lock/u);
  assert.match(sql, /set_config\('lock_timeout', '250ms', true\)/u);
  assert.match(sql, /set_config\('statement_timeout', '3000ms', true\)/u);
  assert.match(sql, /batch_size between 1 and 5000/u);
  assert.match(sql, /p_batch_size > 1000[\s\S]+accepted receipt/u);
  assert.match(sql, /p_batch_size > 500/u);
  assert.match(sql, /interval '30 seconds'/u);
  assert.match(sql, /wal_bytes >= 33554432/u);
  assert.match(sql, /temporary spill detected/u);
  assert.match(sql, /fifteen_minute_baseline_incomplete/u);
  assert.match(sql, /unknown_commit/u);
  assert.match(sql, /next_error_count >= 2/u);
});

test("installs private defense-in-depth state and a disarmed schedule", () => {
  assert.match(sql, /phase text not null default 'disarmed'/u);
  assert.match(sql, /enable row level security/u);
  assert.match(sql, /revoke all on all tables in schema momi_cron_history/u);
  assert.match(
    sql,
    /select cron\.schedule\([\s\S]+momi-cron-history-governor-v1/u,
  );
  assert.doesNotMatch(sql, /vacuum full|cluster\s+|pg_repack/iu);
});
