import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { loadPackage } from
  "../local-tools/legacy-recipe-import/load_package.ts"
import { parseCli } from
  "../local-tools/legacy-recipe-import/parse_cli.ts"
import { validateCli } from
  "../local-tools/legacy-recipe-import/validate_cli.ts"
import { createLegacyRecipeTestPackage } from "./legacy_recipe_test_package.ts"

const project = "xtbraqnlskmqxinjxxdn"

test("parses only the exact development target and defaults to dry run", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const options = parseCli([
    "--env", "dev", "--project-ref", project, "--source", fixture.root,
  ])
  assert.equal(options.dryRun, true)
  assert.equal(options.mode, "import")
  assert.equal(options.backend, "supabase-cli")
  assert.doesNotThrow(() => validateCli(options))
  assert.throws(() => validateCli({
    ...options, environment: "prod", projectRef: "viodfldzuoypnpqaagag",
  }), /Production is prohibited/)
  assert.throws(() => parseCli([
    "--env", "dev", "--project-ref", project, "--source", fixture.root,
    "--password", "secret",
  ]), /unsafe option/)
})

test("validates every package byte, row, and aggregate fingerprint", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const loaded = await loadPackage(fixture.root, fixture.trust)
  assert.equal(loaded.exports[1].sourceRows?.length, 1)
  assert.equal(loaded.exports[15].findings?.length, 1)
  assert.equal(
    loaded.importRunId,
    (await loadPackage(fixture.root, fixture.trust)).importRunId,
  )
})

test("rejects changed exports before any database work", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  await writeFile(fixture.sourcePath, "[]\n")
  await assert.rejects(
    loadPackage(fixture.root, fixture.trust), /byte count mismatch|SHA-256 mismatch/,
  )
})

test("rejects files omitted from the sealed manifest", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  await writeFile(join(fixture.root, "portable", "unexpected.json"), "{}\n")
  await assert.rejects(
    loadPackage(fixture.root, fixture.trust), /differs from the approved sealed allowlist/,
  )
})

test("rejects manifest count drift", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  fixture.manifest.tables[0].sqlite_row_count = 2
  fixture.manifest.tables[0].reread_json_row_count = 2
  await fixture.reseal()
  await assert.rejects(loadPackage(fixture.root, fixture.trust), /Row count mismatch/)
})
