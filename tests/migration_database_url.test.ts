import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { migrationDatabaseUrl } from "../scripts/deploy/migration_database_url.ts"

test("migration commands use an explicit credential-aware pooler URL", async () => {
  const pooler = "postgresql://postgres.ref@pooler.example.com:5432/postgres"
  const patUrl = migrationDatabaseUrl({
    SUPABASE_ACCESS_TOKEN: "sbp_pat",
    SUPABASE_DB_PASSWORD: "sbp_pat",
  }, pooler)
  const passwordUrl = migrationDatabaseUrl({
    SUPABASE_ACCESS_TOKEN: "sbp_pat",
    SUPABASE_DB_PASSWORD: "database-password",
  }, pooler)

  assert.equal(
    patUrl,
    `${pooler}?sslmode=require&options=-c%20jit%3Don`,
  )
  assert.equal(passwordUrl, `${pooler}?sslmode=require`)
  assert.doesNotMatch(patUrl, /sbp_pat/)

  for (const file of ["plan_migrations.ts", "apply_migrations.ts"]) {
    const source = await readFile(
      new URL(`../scripts/deploy/${file}`, import.meta.url),
      "utf8",
    )
    assert.match(source, /"--db-url",\s*\n\s*migrationDatabaseUrl\(\)/)
    assert.doesNotMatch(source, /"--linked"/)
  }
})
