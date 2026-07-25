import assert from "node:assert/strict"
import test from "node:test"

import { findMigrationHistoryViolations } from
  "../scripts/migrations/find_migration_history_violations.ts"

test("permits only an exact hash-bound development correction", () => {
  const name = "001_first.sql"
  const from = "git-blob-sha1:ab290eb4c1f6e10ef89c4d95c1ede4471c4cad69"
  const to = "git-blob-sha1:b403af1538b692ce6dd3c7385ced6f215e23c0a4"
  const corrections = new Map([[name, { from, to }]])
  const services = new Set<string>()
  assert.deepEqual(findMigrationHistoryViolations(
    new Map([[name, from]]),
    new Map([[name, "select 2;\n"]]),
    services,
    "development",
    corrections,
  ), [])
  assert.deepEqual(findMigrationHistoryViolations(
    new Map([[name, from]]),
    new Map([[name, "select 3;\n"]]),
    services,
    "development",
    corrections,
  ), [`${name}: development migration was modified`])
})
