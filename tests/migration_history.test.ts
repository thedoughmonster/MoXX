import assert from "node:assert/strict"
import test from "node:test"

import { findMigrationHistoryViolations } from "../scripts/migrations/find_migration_history_violations.ts"
import { loadProductionMigrations } from
  "../scripts/migrations/load_production_migrations.ts"

const services = new Set(["order-alerting"])

test("rejects modified and deleted production migrations", () => {
  const baseline = new Map([
    ["001_first.sql", "select 1;\n"],
    ["002_second.sql", "select 2;\n"],
  ])
  const current = new Map([["001_first.sql", "select 9;\n"]])
  const violations = findMigrationHistoryViolations(baseline, current, services)
  assert.deepEqual(violations, [
    "001_first.sql: production migration was modified",
    "002_second.sql: production migration was deleted",
  ])
})

test("requires a known owner on new migrations", () => {
  const current = new Map([
    ["003_missing.sql", "select 3;\n"],
    ["004_unknown.sql", "-- service-owner: mystery\nselect 4;\n"],
  ])
  const violations = findMigrationHistoryViolations(new Map(), current, services)
  assert.deepEqual(violations, [
    "003_missing.sql: missing service-owner header",
    "004_unknown.sql: unknown service owner mystery",
  ])
})

test("accepts an owned new migration and normalized line endings", () => {
  const baseline = new Map([["001_first.sql", "select 1;\n"]])
  const current = new Map([
    ["001_first.sql", "select 1;\r\n"],
    ["002_owned.sql", "-- service-owner: order-alerting\nselect 2;\n"],
  ])
  assert.deepEqual(
    findMigrationHistoryViolations(baseline, current, services),
    [],
  )
})

test("compares production Git blob identities against normalized bytes", () => {
  const baseline = new Map([
    ["001_first.sql", "git-blob-sha1:ab290eb4c1f6e10ef89c4d95c1ede4471c4cad69"],
  ])
  assert.deepEqual(
    findMigrationHistoryViolations(
      baseline, new Map([["001_first.sql", "select 1;\r\n"]]), services,
    ),
    [],
  )
  assert.deepEqual(
    findMigrationHistoryViolations(
      baseline, new Map([["001_first.sql", "select 2;\n"]]), services,
    ),
    ["001_first.sql: production migration was modified"],
  )
})

test("rejects ownership headers after physical line 1", () => {
  const current = new Map([
    ["003_blank.sql", "\n-- service-owner: order-alerting\nselect 3;\n"],
    ["004_after_sql.sql", "select 4;\n-- service-owner: order-alerting\n"],
  ])
  assert.deepEqual(findMigrationHistoryViolations(new Map(), current, services), [
    "003_blank.sql: service-owner header must be on physical line 1",
    "004_after_sql.sql: service-owner header must be on physical line 1",
  ])
})

test("rejects duplicate and malformed ownership headers", () => {
  const current = new Map([
    ["003_duplicate.sql", "-- service-owner: order-alerting\n-- service-owner: order-alerting\n"],
    ["004_hidden.sql", "-- service-owner: order-alerting\n-- service-owner nope\n"],
    ["005_malformed.sql", " -- service-owner: order-alerting\nselect 5;\n"],
  ])
  assert.deepEqual(findMigrationHistoryViolations(new Map(), current, services), [
    "003_duplicate.sql: expected exactly one service-owner header, found 2",
    "004_hidden.sql: expected exactly one service-owner header, found 2",
    "005_malformed.sql: malformed service-owner header on physical line 1",
  ])
})

test("does not impose new headers on immutable production history", () => {
  const source = "select 1;\n"
  assert.deepEqual(
    findMigrationHistoryViolations(
      new Map([["001_legacy.sql", source]]),
      new Map([["001_legacy.sql", source]]),
      services,
    ),
    [],
  )
})

test("rejects an alternate ref that could redefine the production baseline", () => {
  const previous = process.env.MOMI_PROD_REF
  process.env.MOMI_PROD_REF = "HEAD"
  try {
    assert.throws(
      () => loadProductionMigrations("supabase/migrations"),
      /MOMI_PROD_REF must be origin\/prod/,
    )
  } finally {
    if (previous === undefined) delete process.env.MOMI_PROD_REF
    else process.env.MOMI_PROD_REF = previous
  }
})
