import assert from "node:assert/strict"
import { mkdtemp, mkdir, rename, rm, symlink, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { createRepositoryFixture } from "./repository_fixture.test_fixture.ts"
import { resolvePinnedNativeCli } from "./resolve_pinned_native_cli.ts"

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const nativeSource = resolvePinnedNativeCli(sourceRoot).sourcePath

test("native resolver accepts only the exact contained lock-bound installation", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "momi-native-resolver-"))
  context.after(() => rm(parent, { recursive: true, force: true }))
  const accepted = join(parent, "accepted")
  createRepositoryFixture(accepted, nativeSource)
  const installation = resolvePinnedNativeCli(accepted)
  assert.equal(installation.sourcePath,
    join(accepted, "node_modules/@supabase/cli-linux-x64/bin/supabase"))
  assert.equal(installation.size, 109_918_528)

  const external = join(parent, "external")
  const linkedModules = join(parent, "linked-modules")
  createRepositoryFixture(external, nativeSource)
  await mkdir(linkedModules)
  await symlink(join(external, "node_modules"), join(linkedModules, "node_modules"), "dir")
  assert.throws(() => resolvePinnedNativeCli(linkedModules))

  const wrapperEscape = join(parent, "wrapper-escape")
  const externalWrapper = join(parent, "external-wrapper")
  createRepositoryFixture(wrapperEscape, nativeSource)
  await rename(join(wrapperEscape, "node_modules/supabase"), externalWrapper)
  await symlink(externalWrapper, join(wrapperEscape, "node_modules/supabase"), "dir")
  assert.throws(() => resolvePinnedNativeCli(wrapperEscape))

  const nativeEscape = join(parent, "native-escape")
  const externalNative = join(parent, "external-native")
  createRepositoryFixture(nativeEscape, nativeSource)
  await rename(join(nativeEscape, "node_modules/@supabase/cli-linux-x64"), externalNative)
  await symlink(externalNative,
    join(nativeEscape, "node_modules/@supabase/cli-linux-x64"), "dir")
  assert.throws(() => resolvePinnedNativeCli(nativeEscape))
})

test("native resolver rejects manifest, bin, symlink, and lock drift", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "momi-native-drift-"))
  context.after(() => rm(parent, { recursive: true, force: true }))
  const cases = ["wrapper", "native", "bin-link", "lock"] as const
  for (const kind of cases) {
    const root = join(parent, kind)
    createRepositoryFixture(root, nativeSource)
    if (kind === "wrapper") {
      await writeFile(join(root, "node_modules/supabase/package.json"), JSON.stringify({
        name: "supabase", version: "2.109.2", bin: { supabase: "dist/other.js" },
      }))
    } else if (kind === "native") {
      await writeFile(join(root, "node_modules/@supabase/cli-linux-x64/package.json"),
        JSON.stringify({ name: "@supabase/cli-linux-x64", version: "2.109.2" }))
    } else if (kind === "bin-link") {
      const path = join(root, "node_modules/@supabase/cli-linux-x64/bin/supabase")
      await unlink(path)
      await symlink(nativeSource, path)
    } else {
      await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n")
    }
    assert.throws(() => resolvePinnedNativeCli(root), undefined, kind)
  }
})
