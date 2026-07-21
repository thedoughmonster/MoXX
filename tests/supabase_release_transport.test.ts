import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("uses one exact password-free JIT URL for preview, apply, and parity", async () => {
  const apply = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  const link = apply.indexOf("linkProject(projectRef)")
  const target = apply.indexOf("assertLinkedSupabaseTarget(projectRef)")
  const url = apply.indexOf("migrationDatabaseUrl(poolerUrl, projectRef)")
  const dryRun = apply.indexOf('"db", "push", "--db-url", databaseUrl, "--dry-run"')
  const push = apply.indexOf('"db", "push", "--db-url", databaseUrl, "--yes"')
  const query = apply.indexOf('"db", "query", "--db-url", databaseUrl')
  const parity = apply.indexOf("assertMigrationParity(hosted)")
  assert.ok(link >= 0 && link < target && target < url && url < dryRun)
  assert.ok(dryRun < push && push < query && query < parity)
  assert.equal(apply.match(/"--db-url", databaseUrl/g)?.length, 3)
  assert.doesNotMatch(apply, /"--linked"/)
})

test("uses explicit database transport only in database release children", async () => {
  const preflight = await readFile(
    new URL("../scripts/release/assert_release_preflight.ts", import.meta.url),
    "utf8",
  )
  const apply = await readFile(
    new URL("../scripts/release/apply_migrations.ts", import.meta.url),
    "utf8",
  )
  assert.match(preflight, /runSupabaseDatabase/)
  assert.match(apply, /runSupabaseDatabase/)
  assert.doesNotMatch(preflight + apply, /"db",\s*"(?:query|push)",\s*"--linked"/)
})
