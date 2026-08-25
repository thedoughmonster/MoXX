import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { findDevelopmentMigrationChangeViolations } from
  "../scripts/migrations/find_development_migration_change_violations.ts"

test("keeps landed development migrations append-only across later pushes", () => {
  const path = "supabase/migrations"
  const zero = "0".repeat(40)
  const one = "1".repeat(40)
  const two = "2".repeat(40)
  const three = "3".repeat(40)
  const source = [
    "commit:one",
    `:000000 100644 ${zero} ${one} A\t${path}/001_added.sql`,
    "commit:two",
    `:100644 100644 ${one} ${two} M\t${path}/001_added.sql`,
    `:000000 100644 ${zero} ${three} A\t${path}/002_deleted.sql`,
    "commit:three",
    `:100644 000000 ${three} ${zero} D\t${path}/002_deleted.sql`,
    `:000000 100644 ${zero} ${three} A\t${path}/002_deleted.sql`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    source,
    path,
    new Set(),
  ), [
    "001_added.sql: development migration changed after landing",
    "002_deleted.sql: development migration was deleted after landing",
    "002_deleted.sql: development migration was re-added",
  ])
})

test("ignores production history and one-time development additions", () => {
  const path = "supabase/migrations"
  const zero = "0".repeat(40)
  const one = "1".repeat(40)
  const two = "2".repeat(40)
  const source = [
    "commit:one",
    `:100644 100644 ${one} ${two} M\t${path}/000_production.sql`,
    `:000000 100644 ${zero} ${one} A\t${path}/001_development.sql`,
    `:100644 100644 ${one} ${two} M\t${path}/AGENTS.md`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    source,
    path,
    new Set(["000_production.sql"]),
  ), [])
})

test("permits only a named development correction", () => {
  const path = "supabase/migrations"
  const one = "1".repeat(40)
  const two = "2".repeat(40)
  const source = [
    "commit:one",
    `:100644 100644 ${one} ${two} M\t${path}/001_corrected.sql`,
    `:100644 100644 ${one} ${two} M\t${path}/002_other.sql`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    source,
    path,
    new Set(),
    new Set(["001_corrected.sql"]),
  ), ["002_other.sql: development migration changed after landing"])
})

test("loads development history from the exact accepted ref", async () => {
  const source = await readFile(new URL(
    "../scripts/migrations/load_development_migration_changes.ts",
    import.meta.url,
  ), "utf8")
  assert.match(source, /process\.env\.MOMI_DEV_REF/)
  assert.match(source, /productSourceCommit\("origin\/prod"\)/)
  assert.match(source, /productSourceCommit\(ref\)/)
  assert.match(source, /\$\{productionSource\}\.\.\$\{developmentSource\}/)
  assert.match(source, /"--raw", "--abbrev=40", "--no-renames"/)
  assert.doesNotMatch(source, /origin\/prod\.\.origin\/dev/)
})
