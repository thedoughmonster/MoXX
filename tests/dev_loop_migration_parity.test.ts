import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import test from "node:test"

import { assertMigrationParity } from
  "../scripts/release/assert_migration_parity.ts"

const versions = readdirSync("supabase/migrations").map((file) =>
  file.match(/^(\d{14})_.+\.sql$/)?.[1]
).filter((version): version is string => Boolean(version)).sort()

test("migration release accepts exact ordered hosted parity", () => {
  const output = JSON.stringify({
    rows: versions.map((version) => ({ version })),
  })
  assert.doesNotThrow(() => assertMigrationParity(output))
})

test("migration release rejects missing hosted history", () => {
  const output = JSON.stringify({
    rows: versions.slice(0, -1).map((version) => ({ version })),
  })
  assert.throws(() => assertMigrationParity(output), /Migration history differs/)
})
