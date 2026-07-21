import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflows = ["deploy-dev.yml", "deploy-prod.yml"]

for (const workflow of workflows) {
  test(`${workflow} does not request database credentials`, async () => {
    const source = await readFile(
      new URL(`../.github/workflows/${workflow}`, import.meta.url),
      "utf8",
    )
    assert.match(source, /SUPABASE_ACCESS_TOKEN/)
    assert.doesNotMatch(source, /SUPABASE_DB_PASSWORD/)
  })
}

test("uses one password-free exact-project JIT migration target", async () => {
  const source = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /"db", "push", "--db-url", databaseUrl, "--dry-run", "--yes"/)
  assert.match(source, /"db", "push", "--db-url", databaseUrl, "--yes"/)
  assert.match(source, /"db", "query", "--db-url", databaseUrl/)
  assert.match(source, /assertLinkedSupabaseTarget\(projectRef\)/)
  assert.match(source, /migrationDatabaseUrl\(poolerUrl, projectRef\)/)
  assert.match(source, /IPv4 session pooler/)
  assert.doesNotMatch(source, /SUPABASE_DB_PASSWORD|PGPASSWORD|--linked/)
})
