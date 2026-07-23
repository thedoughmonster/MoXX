import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { parseMigrationQuery } from
  "../scripts/release/parse_migration_query.ts"

test("parses the machine-readable migration query", () => {
  const source = JSON.stringify({ rows: [
    { version: "20260714090036" },
    { version: "20260714090044" },
  ] })
  assert.deepEqual(parseMigrationQuery(source), [
    "20260714090036",
    "20260714090044",
  ])
})

test("exposes literal one-command releases", async () => {
  const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8")
  const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> }
  assert.equal(packageJson.scripts["release:dev"], "node scripts/run_release.ts --env dev")
  assert.equal(packageJson.scripts["release:prod"], "node scripts/run_release.ts --env prod")
})

test("keeps migration apply in one local coordinator module", async () => {
  const directory = new URL("../scripts/", import.meta.url)
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  const callers: string[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue
    const path = join(entry.parentPath, entry.name)
    const source = await readFile(path, "utf8")
    if (/['"]db['"]\s*,\s*['"]push['"]/.test(source)) {
      callers.push(path.replaceAll("\\", "/").split("/scripts/")[1] ?? path)
    }
  }
  assert.deepEqual(callers, ["release/apply_migrations.ts"])
})

test("disables optional Supabase CLI telemetry during releases", async () => {
  const source = await readFile(
    new URL("../scripts/deploy/supabase_environment.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /SUPABASE_TELEMETRY_DISABLED:\s*"1"/)
})

test("keeps database apply out of GitHub workflows", async () => {
  const directory = new URL("../.github/workflows/", import.meta.url)
  const names = await readdir(directory)
  for (const name of names) {
    const source = await readFile(new URL(name, directory), "utf8")
    assert.doesNotMatch(source, /\bdb\s+push\b|\bmigration\s+repair\b/)
  }
})

test("requires migration completion before development deployment", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-dev.yml", import.meta.url),
    "utf8",
  )
  const release = await readFile(
    new URL("../scripts/release/release_dev.ts", import.meta.url),
    "utf8",
  )
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /expected_sha:/)
  assert.match(workflow, /ref: dev/)
  assert.match(workflow, /MOMI_EXPECTED_SHA" = "\$GITHUB_SHA/)
  const validation = release.indexOf("await waitForWorkflow")
  const apply = release.indexOf('await applyMigrations("dev")')
  const deploy = release.indexOf('await ensureDispatchedWorkflow("deploy-dev.yml"')
  assert.ok(validation >= 0 && validation < apply)
  assert.ok(apply >= 0 && apply < deploy)
  assert.match(release, /if \(preflight\.requiresMigrationApply\)/)
  assert.match(release, /"switch", "--detach", "origin\/dev"/)
  assert.doesNotMatch(release, /"switch", "dev"/)
})

test("dispatches production only after promotion", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-prod.yml", import.meta.url),
    "utf8",
  )
  const release = await readFile(
    new URL("../scripts/release/release_prod.ts", import.meta.url),
    "utf8",
  )
  const resolver = await readFile(
    new URL("../scripts/release/resolve_development_baseline.ts", import.meta.url),
    "utf8",
  )
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /ref: prod/)
  assert.match(workflow, /MOMI_EXPECTED_SHA" = "\$GITHUB_SHA/)
  const apply = release.indexOf('await applyMigrations("prod")')
  const promote = release.indexOf('"promote-prod.yml"')
  const deploy = release.indexOf('"deploy-prod.yml"')
  assert.ok(release.indexOf("await waitForWorkflow") < apply)
  assert.ok(apply >= 0 && apply < promote)
  assert.ok(promote < release.lastIndexOf("await waitForWorkflow"))
  assert.ok(release.lastIndexOf("await waitForWorkflow") < deploy)
  assert.match(release, /productionBefore !== preflight\.headSha/)
  assert.match(release, /undefined, "dev"/)
  assert.match(release, /undefined, "prod"/)
  assert.match(resolver, /--branch", "dev"/)
  assert.match(resolver, /run\.conclusion === "success"/)
  assert.match(resolver, /merge-base", "--is-ancestor"/)
})
