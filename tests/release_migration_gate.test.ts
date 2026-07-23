import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { releaseRequiresMigrations } from
  "../scripts/release/release_requires_migrations.ts"

test("requires database access only when a release can change migrations", () => {
  assert.equal(releaseRequiresMigrations("dev", "fix/code-only", 0), false)
  assert.equal(releaseRequiresMigrations("dev", "fix/with-migration", 1), true)
  assert.equal(releaseRequiresMigrations("dev", "dev", 0), true)
  assert.equal(releaseRequiresMigrations("prod", "dev", 0), true)
  assert.throws(() => releaseRequiresMigrations("dev", "fix/unknown", 128))
})

test("inherits parity only from an exact successful development deployment", async () => {
  const source = await readFile(
    new URL(
      "../scripts/release/assert_deployed_development_baseline.ts",
      import.meta.url,
    ),
    "utf8",
  )
  assert.match(source, /"deploy-dev\.yml"/)
  assert.match(source, /"workflow_dispatch"/)
  assert.match(source, /headSha/)
  assert.match(source, /run\.status !== "completed"/)
  assert.match(source, /run\.conclusion !== "success"/)
})

test("documents sandboxed GitHub auth failures without credential churn", async () => {
  const source = await readFile("docs/release-credentials.md", "utf8")
  assert.match(source, /repeat the same read-only check with approved/)
  assert.match(source, /sandbox can report an inaccessible token as invalid/)
  assert.match(source, /never authorizes logout/)
  assert.match(source, /tooling removal/)
})
