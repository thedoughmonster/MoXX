import assert from "node:assert/strict"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"
import { DEADMAN_RECONCILIATION_SQL_SHA256 } from "./deadman_reconciliation_constants.ts"
import { generateDeadmanReconciliationSql } from "./generate_deadman_reconciliation_sql.ts"
import { modelDeadmanReconciliation } from "./model_deadman_reconciliation.ts"
import { sha256Text } from "./sha256_text.ts"

test("dead-man reconciliation SQL is sealed, read-only, and command-redacted", () => {
  const sql = generateDeadmanReconciliationSql()
  assert.equal(Buffer.byteLength(sql), 13_656)
  assert.equal(sha256Text(sql), DEADMAN_RECONCILIATION_SQL_SHA256)
  assert.equal(parse(sql).length, 1)
  assert.doesNotMatch(sql, /\b(begin|commit|rollback|insert|update|delete)\b/i)
  assert.doesNotMatch(sql, /cron\.(alter_job|schedule|unschedule)/i)
  assert.doesNotMatch(sql, /'command'\s*,/i)
  assert.match(sql, /'terminalCommandSha256'/)
  assert.match(sql, /'terminalCommandMd5'/)
  assert.match(sql, /successfulTerminalRunCount/)
  assert.match(sql, /interval '5 seconds'/)
})

test("reconciliation model permits only exact post-expiry or proved absence states", () => {
  const exact = {
    mode: "known" as const, guardIdentityCount: 1,
    guardIdentityMatches: true, targetStateSafe: true,
    commandBindingValid: true, successfulPostExpiryRun: true,
    failureAfterBaseline: false, ambiguousHistoryAfterBaseline: false,
  }
  assert.equal(modelDeadmanReconciliation(exact), "deadman_reconciled")
  assert.equal(modelDeadmanReconciliation({
    ...exact, mode: "ambiguous", guardIdentityCount: 0,
    guardIdentityMatches: false, commandBindingValid: false,
    successfulPostExpiryRun: false,
  }), "bootstrap_not_committed_or_rolled_back")
  for (const change of [
    { guardIdentityCount: 2 }, { guardIdentityMatches: false },
    { targetStateSafe: false }, { commandBindingValid: false },
    { successfulPostExpiryRun: false }, { failureAfterBaseline: true },
    { ambiguousHistoryAfterBaseline: true },
  ]) assert.equal(modelDeadmanReconciliation({ ...exact, ...change }),
    "manual_reconciliation_required")
})
