import assert from "node:assert/strict"
import test from "node:test"

import { migrationDatabaseUrl } from
  "../scripts/release/migration_database_url.ts"

const projectRef = "abcdefghijklmnopqrst"
const pooler = `postgresql://postgres.${projectRef}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

test("builds one password-free temporary-access session-pooler target", () => {
  const result = migrationDatabaseUrl(pooler, projectRef)
  const url = new URL(result)
  assert.equal(url.username, `postgres.${projectRef}`)
  assert.equal(url.password, "")
  assert.equal(url.searchParams.size, 1)
  assert.equal(url.searchParams.get("options"), "-c jit=true")
  assert.doesNotMatch(result, /secret|token|password/i)
})

test("rejects every mismatched or unsafe migration target", () => {
  const invalid = [
    pooler.replace(projectRef, "tsrqponmlkjihgfedcba"),
    pooler.replace(`postgres.${projectRef}@`, `postgres.${projectRef}:@`),
    pooler.replace("@aws-", ":secret@aws-"),
    pooler.replace(":5432/", ":6543/"),
    pooler.replace(".pooler.supabase.com", ".example.com"),
    pooler.replace("/postgres", "/other"),
    `${pooler}?options=-c%20jit%3Dfalse`,
    `${pooler}?sslmode=require`,
    `${pooler}#fragment`,
    pooler.replace("postgresql:", "http:"),
  ]
  for (const target of invalid) {
    assert.throws(() => migrationDatabaseUrl(target, projectRef))
  }
})
