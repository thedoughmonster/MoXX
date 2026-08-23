import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("repository-only releases dispatch no hosted deployment", async () => {
  const dev = await readFile("scripts/release/release_dev.ts", "utf8")
  assert.match(dev, /databaseApplied = plan\.impact\.release\.database !== "none"/)
  assert.match(dev, /!databaseApplied && !inventoryRequired/)
  assert.doesNotMatch(dev, /applyMigrations/)
  assert.match(dev, /\\? undefined/)
})

test("development migration parity precedes function deployment", async () => {
  const deploy = await readFile("scripts/run_deploy_apply.ts", "utf8")
  const database = deploy.indexOf("applyMigrations(")
  const functions = deploy.indexOf("deployFunctions(")
  assert.ok(database > 0 && database < functions)
  assert.match(deploy, /options\.environment === "dev"/)
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
