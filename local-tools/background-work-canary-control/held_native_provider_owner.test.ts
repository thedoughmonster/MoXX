import assert from "node:assert/strict"
import { closeSync, constants, fstatSync, openSync } from "node:fs"
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { HeldNativeProviderOwner } from "./held_native_provider_owner.ts"
import type { BoundedChildResult } from "./process_types.ts"

const childResult = (stdout: string): BoundedChildResult => {
  const bytes = Buffer.from(stdout)
  return { outcome: { status: "success", exitCode: 0, signal: null,
    stdoutBytes: bytes.length, stderrBytes: 0, limitedStream: null },
  stdout: bytes, stderr: new Uint8Array() }
}

test("owner serializes exact FD commands and rejects use after terminal close", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-owner-"))
  const snapshotDirectory = join(root, "snapshot")
  const queryDirectory = join(root, "query")
  await mkdir(snapshotDirectory, { mode: 0o700 })
  await mkdir(queryDirectory, { mode: 0o700 })
  const executable = join(snapshotDirectory, "supabase")
  const sqlPath = join(queryDirectory, "query.sql")
  await writeFile(executable, "held fixture\n", { mode: 0o500 })
  await writeFile(sqlPath, "select 1;\n", { mode: 0o600 })
  const fd = openSync(executable, constants.O_RDONLY | constants.O_NOFOLLOW)
  const held = fstatSync(fd, { bigint: true })
  await unlink(executable)
  context.after(() => rm(root, { recursive: true, force: true }))
  let releaseQuery: (() => void) | undefined
  const queryPending = new Promise<void>((resolve) => { releaseQuery = resolve })
  const requests: { executable: string; heldExecutable?: object;
    arguments: readonly string[] }[] = []
  const owner = new HeldNativeProviderOwner({
    fd, directory: snapshotDirectory, device: held.dev, inode: held.ino,
    size: Number(held.size),
  }, root, { PATH: "/untrusted", SUPABASE_ACCESS_TOKEN: "private" }, async (request) => {
    requests.push(request)
    if (request.arguments[0] === "--version") return childResult("2.109.1\n")
    await queryPending
    return childResult("[]\n")
  })
  await owner.verifyVersion()
  const first = owner.runQuery({ repositoryRoot: root, sqlPath })
  await assert.rejects(owner.runQuery({ repositoryRoot: root, sqlPath }))
  releaseQuery?.()
  assert.equal((await first).outcome.status, "success")
  assert.deepEqual(requests.map((request) => ({
    executable: request.executable,
    sealed: Object.isFrozen(request.heldExecutable) &&
      Object.keys(request.heldExecutable ?? {}).length === 0,
    arguments: request.arguments,
  })), [{ executable: "/proc/self/fd/3", sealed: true, arguments: ["--version"] }, {
    executable: "/proc/self/fd/3", sealed: true,
    arguments: ["db", "query", "--linked", "--file", sqlPath,
      "--workdir", root, "--output-format", "json"],
  }])
  await owner.close()
  await owner.close()
  assert.equal(owner.status(), "closed")
  await assert.rejects(owner.runQuery({ repositoryRoot: root, sqlPath }))
})

test("owner fails closed when its descriptor identity changes during execution", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-owner-loss-"))
  const directory = join(root, "snapshot")
  await mkdir(directory, { mode: 0o700 })
  const executable = join(directory, "supabase")
  await writeFile(executable, "held fixture\n", { mode: 0o500 })
  const fd = openSync(executable, constants.O_RDONLY | constants.O_NOFOLLOW)
  const held = fstatSync(fd, { bigint: true })
  await unlink(executable)
  context.after(() => rm(root, { recursive: true, force: true }))
  const owner = new HeldNativeProviderOwner({ fd, directory, device: held.dev,
    inode: held.ino, size: Number(held.size) }, root, {}, async () => {
    closeSync(fd)
    return childResult("2.109.1\n")
  })
  await assert.rejects(owner.verifyVersion())
  assert.equal(owner.status(), "lost")
})
