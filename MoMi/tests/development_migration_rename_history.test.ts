import assert from "node:assert/strict"
import test from "node:test"

import { findDevelopmentMigrationChangeViolations } from
  "../scripts/migrations/find_development_migration_change_violations.ts"

const path = "supabase/migrations"
const zero = "0".repeat(40)
const hash = "1".repeat(40)
const other = "2".repeat(40)
const old = "001_old.sql"
const replacement = "002_new.sql"
const correction = {
  from: `git-blob-sha1:${hash}`,
  to: `git-blob-sha1:${hash}`,
  replacement,
}

test("permits only an exact same-commit blob-identical rename", () => {
  const source = [
    "commit:one",
    `:000000 100644 ${zero} ${hash} A\t${path}/${old}`,
    "commit:two",
    `:100644 000000 ${hash} ${zero} D\t${path}/${old}`,
    `:000000 100644 ${zero} ${hash} A\t${path}/${replacement}`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    source, path, new Set(), new Set(), new Map([[old, correction]]),
  ), [])
})

test("does not let a rename correction permit content modification", () => {
  const source = [
    "commit:one",
    `:000000 100644 ${zero} ${hash} A\t${path}/${old}`,
    "commit:two",
    `:100644 100644 ${hash} ${other} M\t${path}/${old}`,
    "commit:three",
    `:100644 000000 ${other} ${zero} D\t${path}/${old}`,
    `:000000 100644 ${zero} ${hash} A\t${path}/${replacement}`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    source, path, new Set(), new Set(), new Map([[old, correction]]),
  ), [
    `${old}: development migration changed after landing`,
    `${old}: development migration was deleted after landing`,
  ])
})

test("rejects a mismatched preimage or unrelated existing replacement", () => {
  const cases = [
    [
      "commit:one",
      `:100644 000000 ${other} ${zero} D\t${path}/${old}`,
      `:000000 100644 ${zero} ${hash} A\t${path}/${replacement}`,
    ],
    [
      "commit:one",
      `:000000 100644 ${zero} ${hash} A\t${path}/${replacement}`,
      "commit:two",
      `:100644 000000 ${hash} ${zero} D\t${path}/${old}`,
    ],
  ]
  for (const lines of cases) {
    assert.deepEqual(findDevelopmentMigrationChangeViolations(
      lines.join("\n"), path, new Set(), new Set(),
      new Map([[old, correction]]),
    ), [`${old}: development migration was deleted after landing`])
  }
})

test("rejects duplicate replacement mappings", () => {
  const duplicate = { ...correction }
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    "", path, new Set(), new Set(), new Map([
      [old, correction], ["003_other.sql", duplicate],
    ]),
  ), [
    `003_other.sql: duplicate development migration replacement ${replacement}`,
  ])
})

test("does not let either correction kind weaken unrelated history rules", () => {
  const renamed = [
    "commit:one",
    `:000000 100644 ${zero} ${hash} A\t${path}/${old}`,
    "commit:two",
    `:100644 000000 ${hash} ${zero} D\t${path}/${old}`,
    `:000000 100644 ${zero} ${hash} A\t${path}/${replacement}`,
    "commit:three",
    `:000000 100644 ${zero} ${hash} A\t${path}/${old}`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    renamed, path, new Set(), new Set(), new Map([[old, correction]]),
  ), [`${old}: development migration was re-added`])

  const deleted = [
    "commit:one",
    `:000000 100644 ${zero} ${hash} A\t${path}/${old}`,
    "commit:two",
    `:100644 000000 ${hash} ${zero} D\t${path}/${old}`,
  ].join("\n")
  assert.deepEqual(findDevelopmentMigrationChangeViolations(
    deleted, path, new Set(), new Set([old]),
  ), [`${old}: development migration was deleted after landing`])
})
