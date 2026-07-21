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

test("links and proves exact access before repository validation", async () => {
  const preflight = await readFile(
    new URL("../scripts/release/assert_release_preflight.ts", import.meta.url),
    "utf8",
  )
  const link = preflight.indexOf("linkProject(projectRef)")
  const target = preflight.indexOf("assertLinkedSupabaseTarget(projectRef)")
  const query = preflight.indexOf('"db", "query", "--linked"')
  const access = preflight.indexOf("assertLinkedSupabaseAccess(access)")
  const validation = preflight.indexOf('"scripts/check.ts"')
  assert.ok(link >= 0 && link < target && target < query)
  assert.ok(query < access && access < validation)
  assert.match(preflight, /select 1::integer as release_access_check/)
  assert.doesNotMatch(preflight, /projects.*list|SUPABASE_DB_PASSWORD|PGPASSWORD|--db-url/)
  const linker = await readFile(
    new URL("../scripts/deploy/link_project.ts", import.meta.url),
    "utf8",
  )
  assert.match(linker, /"--project-ref",\s*projectRef/)
  assert.match(linker, /"--workdir",\s*workspaceRoot/)
  assert.doesNotMatch(linker, /--password|SUPABASE_DB_PASSWORD|PGPASSWORD/)
})

test("strips database passwords from every Supabase child", async () => {
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
