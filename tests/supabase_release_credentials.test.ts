import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { assertLinkedSupabaseAccess } from
  "../scripts/release/assert_linked_supabase_access.ts"

test("requires the exact linked read-only access proof", () => {
  assert.doesNotThrow(() => assertLinkedSupabaseAccess(JSON.stringify({
    rows: [{ release_access_check: 1 }],
  })))
  for (const invalid of [
    "not-json",
    "null",
    JSON.stringify({ rows: [] }),
    JSON.stringify({ rows: [{ release_access_check: 0 }] }),
    JSON.stringify({ rows: [{ release_access_check: 1 }, { release_access_check: 1 }] }),
  ]) assert.throws(() => assertLinkedSupabaseAccess(invalid))
})

test("opens database access only for migration-bearing releases", async () => {
  const preflight = await readFile(
    new URL("../scripts/release/assert_release_preflight.ts", import.meta.url),
    "utf8",
  )
  const link = preflight.indexOf("linkProject(projectRef)")
  const target = preflight.indexOf("assertLinkedSupabaseTarget(projectRef)")
  const url = preflight.indexOf("migrationDatabaseUrl(poolerUrl, projectRef)")
  const query = preflight.indexOf('"db", "query", "--db-url", databaseUrl')
  const access = preflight.indexOf("assertLinkedSupabaseAccess(access)")
  const conditional = preflight.indexOf("if (requiresMigrationApply)")
  const baseline = preflight.indexOf("assertDeployedDevelopmentBaseline(devSha)")
  const validation = preflight.indexOf('"scripts/check.ts"')
  assert.ok(conditional >= 0 && conditional < link)
  assert.ok(link < target && target < url && url < query)
  assert.ok(query < access && access < validation)
  assert.ok(access < baseline && baseline < validation)
  assert.match(preflight, /select 1::integer as release_access_check/)
  assert.doesNotMatch(preflight, /projects.*list|--linked/)
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

test("uses no fixed credential file or credential-bearing URL", async () => {
  const databaseRunner = await readFile(
    new URL("../scripts/deploy/run_supabase_database.ts", import.meta.url),
    "utf8",
  )
  const databaseEnvironment = await readFile(
    new URL("../scripts/deploy/supabase_database_environment.ts", import.meta.url),
    "utf8",
  )
  const databaseUrl = await readFile(
    new URL("../scripts/release/migration_database_url.ts", import.meta.url),
    "utf8",
  )
  const combined = databaseRunner + databaseEnvironment + databaseUrl
  assert.doesNotMatch(combined, /\.supabase\/access-token|readFile|credential store/)
  assert.match(databaseEnvironment, /environment\.PGPASSWORD = temporaryAccessToken/)
  assert.match(databaseEnvironment, /environment\.SUPABASE_DB_PASSWORD = temporaryAccessToken/)
  assert.doesNotMatch(databaseUrl, /SUPABASE_DB_PASSWORD|PGPASSWORD|password\s*=/)
})
