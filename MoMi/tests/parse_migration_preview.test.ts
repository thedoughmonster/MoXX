import assert from "node:assert/strict"
import test from "node:test"

import { assertMigrationPreview } from
  "../scripts/release/assert_migration_preview.ts"
import { parseMigrationPreview } from
  "../scripts/release/parse_migration_preview.ts"

test("parses one migration from the pinned CLI preview format", () => {
  const source = "DRY RUN: migrations will *not* be pushed to the database.\n" +
    "Connecting to remote database...\n" +
    "Would push these migrations:\n" +
    " • 20260101000000_first.sql\n" +
    "Finished supabase db push.\n"
  assert.deepEqual(parseMigrationPreview(source), [
    "20260101000000_first.sql",
  ])
})

test("parses multiple ordered pinned CLI preview bullets", () => {
  const source = "Would push these migrations:\n" +
    " • 20260101000000_first.sql\n" +
    " • 20260102000000_second.sql\n"
  assert.deepEqual(parseMigrationPreview(source), [
    "20260101000000_first.sql",
    "20260102000000_second.sql",
  ])
})

test("accepts only the pinned CLI up-to-date result as empty", () => {
  const source = "DRY RUN: migrations will *not* be pushed to the database.\n" +
    "Connecting to remote database...\n" +
    "Remote database is up to date.\n"
  assert.deepEqual(parseMigrationPreview(source), [])
  assert.throws(
    () => parseMigrationPreview("DRY RUN: migrations will not be pushed.\n"),
    /recognized exact result/,
  )
})

test("rejects malformed, obsolete, ambiguous, and unknown output", () => {
  assert.throws(
    () => parseMigrationPreview(
      "Would push these migrations:\n• 20260101000000_first.sql\n",
    ),
    /invalid migration filename/,
  )
  assert.throws(
    () => parseMigrationPreview(
      "Would push migration 20260101000000_first.sql...\n",
    ),
    /recognized exact result/,
  )
  assert.throws(
    () => parseMigrationPreview(
      "Would push these migrations:\n" +
        " • 20260101000000_first.sql\n" +
        "Remote database is up to date.\n",
    ),
    /ambiguous result sections/,
  )
  assert.throws(
    () => parseMigrationPreview("CLI emitted a new preview format.\n"),
    /recognized exact result/,
  )
})

test("cannot treat an unexpected non-empty preview as empty", () => {
  const source = "Would push these migrations:\n" +
    " • 20260101000000_first.sql\n"
  assert.throws(
    () => assertMigrationPreview([], parseMigrationPreview(source)),
    /extra: 20260101000000_first\.sql/,
  )
})
