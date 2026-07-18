import assert from "node:assert/strict"
import test from "node:test"

import { migrationDatabaseUrl } from
  "../scripts/release/migration_database_url.ts"

const projectRef = "abcdefghijklmnopqrst"
const pooler = `postgresql://postgres.${projectRef}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

test("builds one verified-TLS session-pooler target", () => {
  assert.equal(
    migrationDatabaseUrl(pooler, projectRef),
    `${pooler}?sslmode=verify-full`,
  )
})

test("rejects unsafe or mismatched migration targets", () => {
  const invalid = [
    pooler.replace(projectRef, "tsrqponmlkjihgfedcba"),
    pooler.replace("@aws-", ":secret@aws-"),
    pooler.replace(":5432/", ":6543/"),
    pooler.replace(".pooler.supabase.com", ".example.com"),
    pooler.replace("/postgres", "/other"),
    `${pooler}?sslmode=disable`,
  ]
  for (const target of invalid) {
    assert.throws(() => migrationDatabaseUrl(target, projectRef))
  }
})
