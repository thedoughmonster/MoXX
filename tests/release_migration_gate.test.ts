import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("repository-only releases cannot touch database or application deploy", async () => {
  const dev = await readFile("scripts/release/release_dev.ts", "utf8")
  const database = dev.indexOf("if (databaseApplied)")
  const zeroDeploy = dev.indexOf("release.functions.length === 0")
  assert.ok(database > 0)
  assert.ok(zeroDeploy > database)
  assert.match(dev, /databaseApplied = plan\.impact\.release\.database !== "none"/)
  assert.match(dev, /validatedPlan\.impact\.migrations/)
  assert.match(dev, /\\? undefined/)
})

test("migration transport remains hosted-read, preview, apply, parity", async () => {
  const apply = await readFile("scripts/release/apply_migrations.ts", "utf8")
  const execute = await readFile(
    "scripts/release/execute_migration_release.ts",
    "utf8",
  )
  const hostedBefore = execute.indexOf("io.readHosted()")
  const preview = execute.indexOf("io.preview(plan.includeAll)")
  const push = execute.indexOf("io.apply(plan.includeAll)")
  const parity = execute.lastIndexOf("assertMigrationVersionParity(")
  assert.ok(hostedBefore > 0 && hostedBefore < preview)
  assert.ok(preview < push && push < execute.lastIndexOf("io.readHosted()"))
  assert.ok(execute.lastIndexOf("io.readHosted()") < parity)
  assert.match(apply, /includeAll \? \["--include-all"\] : \[\]/)
  assert.doesNotMatch(apply, /SUPABASE_DB_PASSWORD|PGPASSWORD|--db-url/)
})

test("production promotion binds the exact development receipt", async () => {
  const workflow = await readFile(".github/workflows/promote-prod.yml", "utf8")
  assert.match(workflow, /dev_receipt_sha256:/)
  assert.match(workflow, /\^\[0-9a-f\]\{64\}\$/)
  assert.match(workflow, /expected_sha/)
  assert.doesNotMatch(workflow, /gh pr close/)
})
