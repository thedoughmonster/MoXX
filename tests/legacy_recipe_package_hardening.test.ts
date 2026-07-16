import assert from "node:assert/strict"
import { readFile, rename, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"

import { TRUSTED_LEDGER_SHA256 } from
  "../local-tools/legacy-recipe-import/constants.ts"
import { loadPackage } from
  "../local-tools/legacy-recipe-import/load_package.ts"
import { sha256Text } from
  "../local-tools/legacy-recipe-import/sha256_text.ts"
import { createLegacyRecipeTestPackage } from "./legacy_recipe_test_package.ts"

test("pins the independently audited detached package digest", () => {
  assert.equal(
    TRUSTED_LEDGER_SHA256,
    "861f710a17c25cefbc9658c68921ac733212777481057afcc785ffb8543a54e2",
  )
})

test("rejects a self-consistently tampered checksum ledger", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  const ledgerPath = join(fixture.root, "SHA256SUMS.txt")
  const changed = `${await readFile(ledgerPath, "utf8")}0`.replace(/0$/, "") +
    `${"0".repeat(64)}  unrelated.txt\n`
  await writeFile(ledgerPath, changed)
  await writeFile(
    join(fixture.root, "SHA256SUMS.txt.sha256"),
    `${sha256Text(changed)}  SHA256SUMS.txt\n`,
  )
  await assert.rejects(
    loadPackage(fixture.root, fixture.trust), /Detached package digest is not trusted/,
  )
})

test("rejects a referenced SQLite backup mismatch", async () => {
  const fixture = await createLegacyRecipeTestPackage()
  await writeFile(join(fixture.root, "databases", "toast.sqlite"), "changed\n")
  await assert.rejects(
    loadPackage(fixture.root, fixture.trust), /source database failed authentication/,
  )
})

test("rejects extra, omitted, and duplicate source datasets", async () => {
  const extra = await createLegacyRecipeTestPackage()
  extra.manifest.tables.push({
    ...extra.manifest.tables[0], table: "unrelated", relative_path: "portable/tables/x.json",
  })
  extra.manifest.table_export_count += 1
  await extra.reseal()
  await assert.rejects(loadPackage(extra.root, extra.trust), /table export count/)

  const omitted = await createLegacyRecipeTestPackage()
  omitted.manifest.tables.pop()
  omitted.manifest.table_export_count -= 1
  await omitted.reseal()
  await assert.rejects(loadPackage(omitted.root, omitted.trust), /table export count/)

  const duplicate = await createLegacyRecipeTestPackage()
  duplicate.manifest.tables[14] = { ...duplicate.manifest.tables[0] }
  await duplicate.reseal()
  await assert.rejects(loadPackage(duplicate.root, duplicate.trust), /approved recipe allowlist/)
})

test("rejects package and portable junctions", async (context) => {
  const packageFixture = await createLegacyRecipeTestPackage()
  const packageLink = join(dirname(packageFixture.root), `${Date.now()}-package-link`)
  try {
    await symlink(packageFixture.root, packageLink, "junction")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      context.skip("junction creation is unavailable")
      return
    }
    throw error
  }
  await assert.rejects(loadPackage(packageLink, packageFixture.trust), /link, junction/)

  const portableFixture = await createLegacyRecipeTestPackage()
  const portable = join(portableFixture.root, "portable")
  const target = join(portableFixture.root, "portable-real")
  await rename(portable, target)
  await symlink(target, portable, "junction")
  await assert.rejects(loadPackage(portableFixture.root, portableFixture.trust), /link, junction/)
})

test("hashes and parses each export from one byte buffer", async () => {
  const source = await readFile(new URL(
    "../local-tools/legacy-recipe-import/load_source_exports.ts", import.meta.url,
  ), "utf8")
  assert.match(source, /const bytes = await readSealedBytes/)
  assert.match(source, /loadExportRows\(bytes, pending\)/)
  assert.doesNotMatch(source, /hashFile/)
})
