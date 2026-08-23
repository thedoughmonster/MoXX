import assert from "node:assert/strict"
import test from "node:test"

import { findMigrationHistoryViolations } from
  "../scripts/migrations/find_migration_history_violations.ts"
import { loadDevelopmentMigrationCorrections } from
  "../scripts/migrations/load_development_migration_corrections.ts"

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

test("loads exact blob-identical migration rename corrections", () => {
  const corrections = loadDevelopmentMigrationCorrections()
  assert.deepEqual(corrections.get(
    "20260714084407_create_toast_order_source_versions_view.sql",
  ), {
    from: "git-blob-sha1:8316860d5d87b7cfac32a0b7f399373594361ba0",
    to: "git-blob-sha1:8316860d5d87b7cfac32a0b7f399373594361ba0",
    replacement: "20260714090005_create_toast_order_source_versions_view.sql",
  })
})

test("requires a rename correction to match its replacement blob", () => {
  const hash = "git-blob-sha1:ab290eb4c1f6e10ef89c4d95c1ede4471c4cad69"
  const corrections = new Map([["001_old.sql", {
    from: hash,
    to: hash,
    replacement: "002_new.sql",
  }]])
  assert.deepEqual(findMigrationHistoryViolations(
    new Map([["002_new.sql", hash]]),
    new Map([["002_new.sql", "select 1;\n"]]),
    new Set(),
    "development",
    corrections,
  ), [])
  assert.deepEqual(findMigrationHistoryViolations(
    new Map([["002_new.sql", "git-blob-sha1:0000000000000000000000000000000000000000"]]),
    new Map([["002_new.sql", "select 1;\n"]]),
    new Set(),
    "development",
    corrections,
  ), [
    "002_new.sql: development migration was modified",
    "001_old.sql: development migration replacement does not match correction",
  ])
})
