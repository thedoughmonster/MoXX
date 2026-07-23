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

test("uses the exact linked project through the native CLI login role", async () => {
  const source = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /"db", "push", "--linked", "--dry-run", "--yes"/)
  assert.match(source, /"db", "push", "--linked", "--yes"/)
  assert.match(source, /"db", "query", "--linked"/)
  assert.match(source, /assertLinkedProjectRef\(projectRef\)/)
  assert.match(source, /temporary CLI login role/)
  assert.doesNotMatch(source, /SUPABASE_DB_PASSWORD|PGPASSWORD|--db-url/)
})
