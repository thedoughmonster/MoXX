import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("uses one exact linked CLI target for preview, apply, and parity", async () => {
  const apply = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  const link = apply.indexOf("linkProject(projectRef)")
  const target = apply.indexOf("assertLinkedProjectRef(projectRef)")
  const pushArgs = apply.indexOf('"db", "push", "--linked"')
  const query = apply.indexOf('"db", "query", "--linked"')
  const execute = apply.lastIndexOf("executeMigrationRelease(")
  assert.ok(link >= 0 && link < target && target < pushArgs)
  assert.ok(pushArgs < query && query < execute)
  assert.match(apply, /pushArgs\(includeAll, true\), "combined"/)
  assert.match(apply, /pushArgs\(includeAll, false\)/)
  assert.equal(apply.match(/"--linked"/g)?.length, 2)
  assert.doesNotMatch(apply, /"--db-url"|SUPABASE_DB_PASSWORD|PGPASSWORD/)
})

test("uses the credential-free native CLI runner for release database work", async () => {
  const apply = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  assert.match(apply, /runSupabase/)
  assert.match(apply, /"db",\s*"(?:query|push)",\s*"--linked"/)
  assert.doesNotMatch(
    apply,
    /runSupabaseDatabase|SUPABASE_DB_PASSWORD|PGPASSWORD|--db-url/,
  )
})
