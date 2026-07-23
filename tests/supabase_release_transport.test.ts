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
  const dryRun = apply.indexOf('"db", "push", "--linked", "--dry-run"')
  const push = apply.indexOf('"db", "push", "--linked", "--yes"')
  const query = apply.indexOf('"db", "query", "--linked"')
  const parity = apply.indexOf("assertMigrationParity(hosted)")
  assert.ok(link >= 0 && link < target && target < dryRun)
  assert.ok(dryRun < push && push < query && query < parity)
  assert.equal(apply.match(/"--linked"/g)?.length, 3)
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
