import assert from "node:assert/strict"
import test from "node:test"
import { parse } from "pgsql-ast-parser"

import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"

const guardedCursorKeys = new RegExp([
  "case when jsonb_typeof\\(j\\.cursor\\) = 'object' then",
  "exists \\(select 1 from jsonb_object_keys\\(j\\.cursor\\)\\)",
  "and not exists \\(select 1 from jsonb_object_keys\\(j\\.cursor\\) key",
  "where key not in \\('page', 'pageToken', 'window_start', 'businessDate'\\)\\)",
  "else false end",
].join("\\s+"))

test("recovery snapshot accepts only the three exact Toast lineage classes", () => {
  const sql = loadRecoverySnapshotSql()
  assert.deepEqual(parse(sql).map((statement) => statement.type), ["with"])
  assert.match(sql, /schedule\.matches = 1 and j\.page_count = 0\s+and j\.cursor = '\{\}'::jsonb/)
  assert.match(sql, /schedule\.matches = 1 and schedule\.legal_cursor\s+and j\.page_count > 0 and j\.page_count < j\.page_budget\s+and j\.cursor <> '\{\}'::jsonb/)
  assert.match(sql, /j\.operation_key = 'toast\.payments\.get\.v1' and j\.mode = 'repair'/)
  assert.match(sql, /j\.reason = 'Payment detail discovered from archived payment list'/)
  assert.match(sql, /split_part\(j\.idempotency_key, ':', 2\) = parent\.job_id::text/)
  assert.match(sql, /split_part\(j\.idempotency_key, ':', 3\) = lower\(j\.parameters ->> 'guid'\)/)
  assert.match(sql, /j\.parameters = jsonb_build_object\('guid', j\.parameters ->> 'guid'\)/)
  assert.match(sql, /parent\.operation_key = 'toast\.payments\.list\.v1'/)
  assert.match(sql, /\(parent\.source_key, parent\.restaurant_guid, parent\.correlation_id\) =\s+\(j\.source_key, j\.restaurant_guid, j\.correlation_id\)/)
  assert.match(sql, /detail\.source_operation_id = 'paymentsGuidGet'/)
  assert.match(sql, /parameter\.parameter_location = 'path' and parameter\.data_type = 'string'/)
  assert.match(sql, /accepted_lineage_count <> 1/)
})

test("Toast lineage rejects every continuation and fanout near miss", () => {
  const sql = loadRecoverySnapshotSql()
  for (const required of [
    /schedule\.matches = 1/,
    /a\.pagination_kind in \('page', 'cursor'\)\s+or a\.requires_window/,
    guardedCursorKeys,
    /key not in \('page', 'pageToken', 'window_start', 'businessDate'\)/,
    /a\.pagination_kind = 'page'/,
    /jsonb_typeof\(j\.cursor -> 'page'\) = 'number'/,
    /a\.pagination_kind = 'cursor'/,
    /btrim\(j\.cursor ->> 'pageToken'\) = j\.cursor ->> 'pageToken'/,
    /length\(j\.cursor ->> 'pageToken'\) between 1 and 16384/,
    /j\.cursor ->> 'businessDate' ~ '\^\[0-9\]\{8\}\$'/,
    /pg_input_is_valid\(concat\(substring\(j\.cursor ->> 'businessDate'/,
    /pg_input_is_valid\(j\.cursor ->> 'window_start', 'timestamptz'\)/,
    /j\.page_count > 0/,
    /j\.page_count < j\.page_budget/,
    /j\.cursor <> '\{\}'::jsonb/,
    /j\.window_start is null and j\.window_end is null/,
    /parent\.status in \('pending', 'running', 'succeeded'\)/,
    /parent\.created_at <= c\.observed_at/,
    /detail\.pagination_kind = 'none'/,
    /detail\.exact_resource_only and detail\.is_enabled/,
    /parameter\.required and parameter\.validation_pattern is not null/,
    /where extra\.operation_key = detail\.operation_key\) = 1/,
  ]) assert.match(sql, required)
  assert.match(sql, /\(\(j\.page_count <> 0 or j\.cursor <> '\{\}'::jsonb\)\s+and not j\.legal_continuation\)/)
  assert.doesNotMatch(sql, /j\.mode = 'repair' then 1/)
  assert.doesNotMatch(sql, /jsonb_object_length/)
})

test("cursor key enumeration is guarded for every JSONB shape", () => {
  const sql = loadRecoverySnapshotSql()
  assert.match(sql, guardedCursorKeys)
  assert.equal((sql.match(/jsonb_object_keys\(j\.cursor\)/g) ?? []).length, 2)
  for (const rejected of [null, {}, [], "cursor", 1, true]) {
    assert.equal(rejected !== null && !Array.isArray(rejected) &&
      typeof rejected === "object" && Object.keys(rejected).length > 0, false)
  }
  assert.equal(Object.keys({ pageToken: "next" }).length > 0, true)
})

test("routing lineage separates valid projectors from zero-target projectors", () => {
  const sql = loadRecoverySnapshotSql()
  assert.match(sql, /w\.source_system = 'toast' and w\.event_name like 'source\.toast\.%'\s+and matches\.active_eligible = 1/)
  assert.match(sql, /e\.event_name in \('warehouse\.order\.observed', 'warehouse\.order\.reconciled'\)\s+and e\.source_system = 'toast' and e\.source_resource_type = 'order'\s+and e\.schema_version = 2 and e\.entity_type = 'order'/)
  assert.match(sql, /e\.idempotency_key ~ \('\^warehouse:order:/)
  assert.match(sql, /e\.event_name = 'warehouse\.stock\.observed'\s+and e\.source_system = 'toast' and e\.source_resource_type = 'stock_state'\s+and e\.schema_version = 1 and e\.entity_type = 'menu_item'/)
  assert.match(sql, /e\.idempotency_key ~ \('\^warehouse:stock:/)
  assert.match(sql,
    /where e\.event_name = 'warehouse\.order\.observed' or matches\.patterns = 0/)
  assert.match(sql, /parents\.parent_count = 1[\s\S]*then 1 else 0 end/)
  assert.match(sql, /w\.event_name = 'warehouse\.order\.observed'\s+and matches\.patterns = 1 and matches\.active_eligible = 1/)
  assert.match(sql, /projector_parent_candidates/)
  assert.match(sql, /child\.correlation_id = source\.correlation_id/)
  assert.match(sql, /w\.accepted_lineage_count <> 1/)
  assert.doesNotMatch(sql, /w\.event_name like 'warehouse\.%'/)
})

test("lawful order observations require one deterministic webhook ancestry", () => {
  const sql = loadRecoverySnapshotSql()
  for (const contract of [
    /child\.event_name <> 'warehouse\.order\.observed'/,
    /join momi_warehouse\.entity_versions version/,
    /join momi_warehouse\.version_observations observation/,
    /observation\.source_observation_key = 'toast:event:' \|\| source\.event_id::text/,
    /source\.event_name = 'source\.toast\.webhook\.orders\.observed'/,
    /source\.source_reference ->> 'table' = 'webhook_events'/,
    /join toast_raw\.webhook_events webhook/,
    /webhook\.subscription_key = 'orders'/,
    /version\.source_version_id = 'webhook:' \|\| webhook\.event_guid/,
    /version\.provenance ->> 'source_observation_key'\s+= observation\.source_observation_key/,
    /observation\.source_reference ->> 'source_version_id'\s+= version\.source_version_id/,
  ]) assert.match(sql, contract)
})

test("missing, duplicate, ambiguous, and multi-root projector ancestry fails closed", () => {
  const sql = loadRecoverySnapshotSql()
  assert.match(sql, /projector_parent_candidates as \([\s\S]*union all/)
  assert.match(sql, /select child_event_id, count\(\*\)::bigint as parent_count/)
  assert.doesNotMatch(sql,
    /select child_event_id, count\(distinct parent_event_id\)::bigint as parent_count/)
  assert.match(sql, /parents\.parent_count = 1[\s\S]*then 1 else 0 end/)
  assert.match(sql, /w\.accepted_lineage_count <> 1/)
})

test("the frozen subscription catalog is fingerprinted without row details", () => {
  const sql = loadRecoverySnapshotSql()
  assert.match(sql, /routing_catalog as \(/)
  assert.match(sql, /order by subscription_key/)
  assert.match(sql, /'routingCatalogCount', k\.rows/)
  assert.match(sql, /'routingCatalogSha256', k\.fingerprint/)
  assert.doesNotMatch(sql, /jsonb_agg\([^)]*subscription/i)
})
