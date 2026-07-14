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

test("keeps database credentials out of repository deployment", async () => {
  const source = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /"db", "push", "--linked", "--dry-run"/)
  assert.match(source, /IPv4 session pooler/)
  assert.match(source, /5432/)
  assert.doesNotMatch(source, /SUPABASE_DB_PASSWORD|PGPASSWORD/)
})
