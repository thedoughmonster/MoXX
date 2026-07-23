import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("repository-only releases cannot touch database or application deploy", async () => {
  const dev = await readFile("scripts/release/release_dev.ts", "utf8")
  const database = dev.indexOf('if (databaseApplied) await applyMigrations("dev")')
  const zeroDeploy = dev.indexOf("release.functions.length === 0")
  assert.ok(database > 0)
  assert.ok(zeroDeploy > database)
  assert.match(dev, /databaseApplied = plan\.impact\.release\.database !== "none"/)
  assert.match(dev, /\\? undefined/)
})

test("migration transport remains preview, apply, then parity", async () => {
  const source = await readFile("scripts/release/apply_migrations.ts", "utf8")
  const preview = source.indexOf('"db", "push", "--linked", "--dry-run", "--yes"')
  const apply = source.indexOf('"db", "push", "--linked", "--yes"')
  const parity = source.indexOf("assertMigrationParity(hosted)")
  assert.ok(preview > 0 && preview < apply && apply < parity)
  assert.doesNotMatch(source, /SUPABASE_DB_PASSWORD|PGPASSWORD|--db-url/)
})

test("production promotion binds the exact development receipt", async () => {
  const workflow = await readFile(".github/workflows/promote-prod.yml", "utf8")
  assert.match(workflow, /dev_receipt_sha256:/)
  assert.match(workflow, /\^\[0-9a-f\]\{64\}\$/)
  assert.match(workflow, /expected_sha/)
  assert.doesNotMatch(workflow, /gh pr close/)
})
