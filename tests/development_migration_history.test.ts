import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { findDevelopmentMigrationChangeViolations } from
  "../scripts/migrations/find_development_migration_change_violations.ts"

test("keeps landed development migrations append-only across later pushes", () => {
  const path = "supabase/migrations"
  const source = [
    "commit:one",
    `A\t${path}/001_added.sql`,
    "commit:two",
    `M\t${path}/001_added.sql`,
    `A\t${path}/002_deleted.sql`,
    "commit:three",
    `D\t${path}/002_deleted.sql`,
    `A\t${path}/002_deleted.sql`,
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
  const source = [
    `M\t${path}/000_production.sql`,
    `A\t${path}/001_development.sql`,
    `M\t${path}/AGENTS.md`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    source,
    path,
    new Set(["000_production.sql"]),
  ), [])
})

test("loads development history from the exact accepted ref", async () => {
  const source = await readFile(new URL(
    "../scripts/migrations/load_development_migration_changes.ts",
    import.meta.url,
  ), "utf8")
  assert.match(source, /process\.env\.MOMI_DEV_REF/)
  assert.match(source, /origin\/prod\.\.\$\{ref\}/)
  assert.doesNotMatch(source, /origin\/prod\.\.origin\/dev/)
})
