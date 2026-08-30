import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("selects the documented non-scheduled database access authority", () => {
  assert.equal(existsSync(".github/workflows/renew-database-access.yml"), false)
  assert.equal(
    existsSync("MoMi/.github/workflows/renew-database-access.yml"),
    false,
  )
  assert.equal(
    JSON.parse(read("MoMi/package.json")).scripts["database-access:renew"],
    undefined,
  )

  const authority = read("MoMi/docs/release-credentials.md")
  assert.match(authority, /MOX-409 production authority/)
  assert.match(authority, /thedoughmonster\/MoXX/)
  assert.match(
    authority,
    /authoritative\s+integration branch; production workflow configuration remains on `prod`/,
  )
  assert.match(authority, /GitHub `prod` environment secret `SUPABASE_ACCESS_TOKEN`/)
  assert.match(authority, /owned by Zac/)
  assert.match(authority, /no\s+`expires_at`/)
  assert.match(authority, /release-host CLI profile is a separate credential/)
  assert.match(authority, /continues to use the CLI-owned short-lived database login/)
  assert.match(authority, /\.github\/workflows\/deploy-prod\.yml/)
  assert.match(authority, /\.github\/workflows\/supabase-credential-preflight\.yml/)
  assert.match(authority, /thedoughmonster\/momi-backend/)
  assert.match(authority, /\.github\/workflows\/renew-database-access\.yml/)
  assert.match(
    authority,
    /source GitHub `prod` environment secret `SUPABASE_ACCESS_TOKEN`/,
  )
  assert.match(authority, /workflow state is `disabled_manually`/)
  assert.match(authority, /rollback drill is proof-only/)
  assert.match(authority, /registers no monthly or other scheduled renewal event/)
  assert.match(
    authority,
    /Re-enabling the source scheduler[\s\S]*requires\s+separate explicit authority/,
  )
})

test("keeps the production mapping proof manual and read-only", () => {
  const workflow = read(".github/workflows/supabase-credential-preflight.yml")
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /prod: 'viodfldzuoypnpqaagag'/)
  assert.match(workflow, /\/jit-access/)
  assert.match(workflow, /appliedSuccessfully !== true/)
  assert.match(workflow, /\/database\/jit/)
  assert.match(workflow, /postgres\.expires_at != null/)
  assert.match(workflow, /permanent_database_mapping/)
  assert.match(workflow, /scripts\/assert-supabase-preflight-authority\.mjs/)
  assert.ok(
    workflow.indexOf("Verify exact workflow authority before secret use") <
      workflow.indexOf("secrets.SUPABASE_ACCESS_TOKEN"),
  )
  assert.doesNotMatch(workflow, /schedule:/)
  assert.doesNotMatch(workflow, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i)
})
