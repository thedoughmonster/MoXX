import assert from "node:assert/strict"
import test from "node:test"

import { parseMigrationQuery } from "../scripts/release/parse_migration_query.ts"

const row = { version: "20260814125234" }

test("accepts normal and agent-mode Supabase JSON query output", () => {
  assert.deepEqual(parseMigrationQuery(JSON.stringify([row])), [row.version])
  assert.deepEqual(parseMigrationQuery(JSON.stringify({ rows: [row] })), [row.version])
})

test("rejects missing rows and malformed migration versions", () => {
  assert.throws(() => parseMigrationQuery("{}"), /returned no rows/)
  assert.throws(() => parseMigrationQuery('[{"version":"latest"}]'), /invalid version/)
  assert.throws(() => parseMigrationQuery("[null]"), /invalid version/)
})
