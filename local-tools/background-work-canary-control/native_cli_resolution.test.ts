import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink,
  writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createRealNativeFixture } from "./create_real_native_fixture.test_fixture.ts"
import { createRepositoryFixture } from "./repository_fixture.test_fixture.ts"
import { REQUIRED_SUPABASE_NATIVE_BYTES } from "./repository_preflight_constants.ts"
import { resolvePinnedNativeCli } from "./resolve_pinned_native_cli.ts"

test("native resolver binds the exact contained package, manifest, bin, and lock", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "momi-native-resolution-"))
  context.after(() => rm(parent, { recursive: true, force: true }))
  const accepted = join(parent, "accepted")
  const nativePath = createRealNativeFixture(accepted)
  const resolved = resolvePinnedNativeCli(accepted)
  assert.equal(resolved.sourcePath, nativePath)
  assert.equal(resolved.size, REQUIRED_SUPABASE_NATIVE_BYTES)

  const externalInstall = join(parent, "external-install")
  createRealNativeFixture(externalInstall)
  const wholeLink = join(parent, "whole-node-modules-link")
  await mkdir(wholeLink)
  await symlink(join(externalInstall, "node_modules"), join(wholeLink, "node_modules"), "dir")
  assert.throws(() => resolvePinnedNativeCli(wholeLink))

  const packageLink = join(parent, "external-package-link")
  createRealNativeFixture(packageLink)
  const externalPackage = join(parent, "external-supabase-package")
  await rename(join(packageLink, "node_modules/supabase"), externalPackage)
  await symlink(externalPackage, join(packageLink, "node_modules/supabase"), "dir")
  assert.throws(() => resolvePinnedNativeCli(packageLink))

  const nativeLink = join(parent, "external-native-link")
  createRealNativeFixture(nativeLink)
  const nativeRoot = join(nativeLink, "node_modules/@supabase/cli-linux-x64")
  const externalNative = join(parent, "external-native-package")
  await rename(nativeRoot, externalNative)
  await symlink(externalNative, nativeRoot, "dir")
  assert.throws(() => resolvePinnedNativeCli(nativeLink))

  const shimLink = join(parent, "shim-link")
  createRealNativeFixture(shimLink)
  const shim = join(shimLink, "node_modules/supabase/dist/supabase.js")
  await rename(shim, `${shim}.real`)
  await symlink(`${shim}.real`, shim)
  assert.throws(() => resolvePinnedNativeCli(shimLink))

  const executableLink = join(parent, "native-executable-link")
  createRepositoryFixture(executableLink)
  const executable = join(executableLink,
    "node_modules/@supabase/cli-linux-x64/bin/supabase")
  await unlink(executable)
  await symlink(nativePath, executable)
  assert.throws(() => resolvePinnedNativeCli(executableLink))

  const drifts: Array<[string, (value: Record<string, unknown>) => void]> = [
    ["node_modules/supabase/package.json", (value) => { value.name = "supabase-drift" }],
    ["node_modules/supabase/package.json", (value) => { value.version = "2.109.2" }],
    ["node_modules/supabase/package.json", (value) => {
      value.bin = { supabase: "dist/other.js" }
    }],
    ["node_modules/supabase/package.json", (value) => {
      value.optionalDependencies = { "@supabase/cli-linux-x64": "2.109.2" }
    }],
    ["node_modules/@supabase/cli-linux-x64/package.json", (value) => {
      value.name = "@supabase/cli-linux-x64-drift"
    }],
    ["node_modules/@supabase/cli-linux-x64/package.json", (value) => {
      value.version = "2.109.2"
    }],
    ["node_modules/@supabase/cli-linux-x64/package.json", (value) => {
      value.files = ["other/"]
    }],
  ]
  for (const [index, [relativePath, mutate]] of drifts.entries()) {
    const root = join(parent, `manifest-drift-${index}`)
    createRealNativeFixture(root)
    const path = join(root, relativePath)
    const value = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
    mutate(value)
    await writeFile(path, JSON.stringify(value))
    assert.throws(() => resolvePinnedNativeCli(root), relativePath)
  }

  for (const [index, change] of [
    ["'@supabase/cli-linux-x64': 2.109.1",
      "'@supabase/cli-linux-x64': 2.109.2"],
    ["sha512-svFmamF/", "sha512-drifted/"],
  ].entries()) {
    const root = join(parent, `lock-drift-${index}`)
    createRealNativeFixture(root)
    const lockPath = join(root, "pnpm-lock.yaml")
    await writeFile(lockPath, (await readFile(lockPath, "utf8"))
      .replace(change[0], change[1]))
    assert.throws(() => resolvePinnedNativeCli(root))
  }
})
