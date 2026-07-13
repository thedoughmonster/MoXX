import assert from "node:assert/strict"
import test from "node:test"

import { findMigrationHistoryViolations } from "../scripts/migrations/find_migration_history_violations.ts"

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
