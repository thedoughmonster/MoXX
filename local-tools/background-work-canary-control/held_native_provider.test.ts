import assert from "node:assert/strict"
import { access, chmod, link, mkdir, mkdtemp, open, readdir, rename, rm,
  symlink, unlink, writeFile } from "node:fs/promises"
import { fstatSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createHeldNativeProvider } from "./create_held_native_provider.ts"
import { createRealNativeFixture } from "./create_real_native_fixture.test_fixture.ts"
import { HeldNativeProviderOwner } from "./held_native_provider_owner.ts"
import { resolvePinnedNativeCli } from "./resolve_pinned_native_cli.ts"
import { runBoundedChild } from "./run_bounded_child.ts"
import { HELD_EXECUTABLES } from "./sealed_held_executable.ts"
import { snapshotNativeCli } from "./snapshot_native_cli.ts"
import type { BoundedChildResult } from "./process_types.ts"

test("held fd3 survives source, hardlink, shim, native path, and PATH mutation", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-held-native-root-"))
  const fakeBin = await mkdtemp(join(tmpdir(), "momi-held-native-path-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  context.after(() => rm(fakeBin, { recursive: true, force: true }))
  const sourcePath = createRealNativeFixture(root, true)
  const snapshot = snapshotNativeCli(resolvePinnedNativeCli(root), tmpdir())
  const staged = fstatSync(snapshot.fd, { bigint: true })
  assert.equal(staged.nlink, 0n)
  assert.equal(staged.mode & 0o777n, 0o500n)
  assert.deepEqual(await readdir(snapshot.directory), [])
  const nodeMarker = join(root, "fake-node-ran")
  const nativeMarker = join(root, "fake-native-ran")
  await writeFile(join(fakeBin, "node"), `#!/bin/sh\n: > '${nodeMarker}'\nexit 99\n`)
  await writeFile(join(fakeBin, "supabase"), `#!/bin/sh\n: > '${nativeMarker}'\nexit 99\n`)
  await Promise.all([chmod(join(fakeBin, "node"), 0o500),
    chmod(join(fakeBin, "supabase"), 0o500)])
  const owner = new HeldNativeProviderOwner(snapshot, root, { PATH: fakeBin }, runBoundedChild)
  await owner.verifyVersion()

  const shim = join(root, "node_modules/supabase/dist/supabase.js")
  await rename(shim, `${shim}.old`)
  await writeFile(shim, `#!/bin/sh\n: > '${nativeMarker}'\nexit 99\n`, { mode: 0o500 })
  const hardlink = `${sourcePath}.hardlink`
  await link(sourcePath, hardlink)
  const mutableSource = await open(hardlink, "r+")
  const changed = Buffer.alloc(1)
  await mutableSource.read(changed, 0, 1, 4096)
  changed[0] ^= 0xff
  await mutableSource.write(changed, 0, 1, 4096)
  await mutableSource.sync()
  await mutableSource.close()
  await unlink(sourcePath)
  await symlink(join(fakeBin, "supabase"), sourcePath)
  await owner.verifyVersion()
  await assert.rejects(access(nodeMarker))
  await assert.rejects(access(nativeMarker))
  await assert.rejects(runBoundedChild({
    executable: "/proc/self/fd/4", heldExecutable: HELD_EXECUTABLES.seal({
      fd: snapshot.fd, device: snapshot.device, inode: snapshot.inode, size: snapshot.size,
    }),
    arguments: ["--version"], environment: { PATH: fakeBin },
  }))
  await assert.rejects(runBoundedChild({
    executable: "/proc/self/fd/3", arguments: ["--version"],
  }))

  const directory = snapshot.directory
  await owner.close()
  assert.equal(owner.status(), "closed")
  await assert.rejects(access(directory))
  await unlink(sourcePath)
  await rename(hardlink, sourcePath)
  assert.throws(() => snapshotNativeCli(resolvePinnedNativeCli(root), tmpdir()))
  const reused = await open(join(root, "fd-reuse-marker"), "w", 0o600)
  try { await assert.rejects(owner.verifyVersion()) } finally { await reused.close() }
})

test("production factory exposes no descriptor or path and runs exact native version", async () => {
  const sourceRoot = join(import.meta.dirname, "../..")
  const fakeBin = await mkdtemp(join(tmpdir(), "momi-held-facade-path-"))
  const marker = join(fakeBin, "intercepted")
  try {
    await writeFile(join(fakeBin, "node"), `#!/bin/sh\n: > '${marker}'\nexit 99\n`, {
      mode: 0o500,
    })
    const provider = await createHeldNativeProvider(sourceRoot, { PATH: fakeBin }, runBoundedChild)
    assert.deepEqual(Object.keys(provider).sort(), ["close", "runQuery", "status"])
    assert.equal(Object.getOwnPropertySymbols(provider).length, 0)
    assert.equal(provider.status(), "held")
    await assert.rejects(access(marker))
    await provider.close()
    assert.equal(provider.status(), "closed")
  } finally { await rm(fakeBin, { recursive: true, force: true }) }
})

test("private owner rejects concurrent work and close while active", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-held-concurrency-"))
  const directory = join(root, "stage")
  const path = join(directory, "held")
  context.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(directory, { mode: 0o700 })
  await writeFile(path, "private held fixture\n", { mode: 0o500 })
  const file = await open(path, "r")
  const stat = await file.stat({ bigint: true })
  await unlink(path)
  let release: ((value: BoundedChildResult) => void) | undefined
  const blocked = new Promise<BoundedChildResult>((resolve) => { release = resolve })
  const owner = new HeldNativeProviderOwner({
    fd: file.fd, directory, device: stat.dev, inode: stat.ino, size: Number(stat.size),
  }, root, {}, async () => await blocked)
  const first = owner.verifyVersion()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(owner.status(), "active")
  await assert.rejects(owner.verifyVersion())
  await assert.rejects(owner.close())
  const stdout = new TextEncoder().encode("2.109.1\n")
  release?.({ outcome: { status: "success", exitCode: 0,
    signal: null, stdoutBytes: stdout.byteLength, stderrBytes: 0, limitedStream: null },
  stdout, stderr: new Uint8Array() })
  await first
  assert.equal(owner.status(), "held")
  await owner.close()
})
