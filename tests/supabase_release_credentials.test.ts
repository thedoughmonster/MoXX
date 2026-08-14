import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("opens database access only through the migration apply path", async () => {
  const dev = await readFile(
    new URL("../scripts/release/release_dev.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(dev, /applyMigrations|linkProject|runSupabase|SUPABASE/)
  const deploy = await readFile(
    new URL("../scripts/run_deploy_apply.ts", import.meta.url),
    "utf8",
  )
  assert.match(deploy, /options\.environment === "dev"/)
  assert.match(deploy, /applyMigrations\("dev", plan\.impact\.migrations\)/)
  assert.ok(deploy.indexOf("assertGitHubDeploymentAuthority") <
    deploy.indexOf("applyMigrations("))
  const linker = await readFile(
    new URL("../scripts/deploy/link_project.ts", import.meta.url),
    "utf8",
  )
  assert.match(linker, /"--project-ref",\s*projectRef/)
  assert.match(linker, /"--workdir",\s*workspaceRoot/)
  assert.doesNotMatch(linker, /--password|SUPABASE_DB_PASSWORD|PGPASSWORD/)
})

test("keeps database credentials out of every general child", async () => {
  const command = await readFile(
    new URL("../scripts/release/run_command.ts", import.meta.url),
    "utf8",
  )
  const supabase = await readFile(
    new URL("../scripts/deploy/run_supabase.ts", import.meta.url),
    "utf8",
  )
  const environment = await readFile(
    new URL("../scripts/deploy/supabase_environment.ts", import.meta.url),
    "utf8",
  )
  assert.match(command, /delete env\.SUPABASE_DB_PASSWORD/)
  assert.match(command, /delete env\.PGPASSWORD/)
  assert.match(supabase, /supabaseEnvironment\(process\.env\)/)
  assert.match(environment, /delete environment\.SUPABASE_DB_PASSWORD/)
  assert.match(environment, /delete environment\.PGPASSWORD/)
  assert.doesNotMatch(supabase, /databasePassword|"--password"|SUPABASE_DB_PASSWORD/)
  assert.doesNotMatch(environment, /environment\.PGPASSWORD\s*=/)
})

test("leaves temporary database credentials entirely inside the CLI", async () => {
  const runner = await readFile(
    new URL("../scripts/deploy/run_supabase.ts", import.meta.url),
    "utf8",
  )
  const environment = await readFile(
    new URL("../scripts/deploy/supabase_environment.ts", import.meta.url),
    "utf8",
  )
  const apply = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  const combined = runner + environment + apply
  assert.doesNotMatch(combined, /\.supabase\/access-token|readFile|credential store/)
  assert.match(environment, /delete environment\.SUPABASE_DB_PASSWORD/)
  assert.match(environment, /delete environment\.PGPASSWORD/)
  assert.match(apply, /"--linked"/)
  assert.doesNotMatch(combined, /"--password"|--db-url/)
})
