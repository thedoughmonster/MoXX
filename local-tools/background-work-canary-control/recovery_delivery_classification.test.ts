import assert from "node:assert/strict"
import test from "node:test"

import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"

test("cohort delivery queue identity comes from authoritative subscriptions", () => {
  const sql = loadRecoverySnapshotSql()
  assert.match(sql, /cohort_deliveries as \(\s+select distinct e\.root_key, d\.\*, s\.queue_name/)
  assert.match(sql, /join momi_events\.deliveries d using \(event_id\)\s+join momi_events\.subscriptions s using \(subscription_key\)/)
  assert.match(sql, /cohort_queue_validation as \([\s\S]*d\.queue_name/)
})

test("terminal delivery history is retained but only nonterminal rows are open", () => {
  const sql = loadRecoverySnapshotSql()
  assert.match(sql, /delivery_open as \(\s+select d\.\*/)
  assert.doesNotMatch(sql, /delivery_open as \([\s\S]{0,240}where d\.status/)
  assert.match(sql,
    /count\(\*\) filter \(where d\.status not in \('delivered', 'dead_letter'\)\)::bigint as open_rows/)
  assert.match(sql,
    /count\(\*\) filter \(where d\.status in \('pending', 'queued'\) and d\.next_attempt_at <= c\.observed_at\)::bigint as ready/)
  assert.match(sql,
    /from cohort_deliveries\s+where status not in \('delivered', 'dead_letter'\)\)::bigint as delivery_open/)
  const statuses = [...Array.from({ length: 200 }, () => "delivered"), "pending"]
  assert.equal(statuses.filter((status) =>
    !["delivered", "dead_letter"].includes(status)).length, 1)
  assert.equal(statuses.filter((status) => ["pending", "queued"].includes(status)).length, 1)
  assert.equal(statuses.length, 201)
})
