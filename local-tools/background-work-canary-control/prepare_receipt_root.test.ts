import assert from "node:assert/strict"
import { lstat, mkdir, mkdtemp, readFile, readdir,
  rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { prepareReceiptRootForHome } from "./prepare_receipt_root_for_home.ts"

test("receipt root is the one fixed OS-home-relative path", async () => {
  const home = await mkdtemp(join(tmpdir(), "momi-canary-home-"))
  try {
    const root = await prepareReceiptRootForHome(home)
    assert.equal(root, join(home, ".local/state/momi/background-work-canary"))
    const info = await lstat(root)
    assert.equal(info.isDirectory(), true)
    assert.equal(info.isSymbolicLink(), false)
    assert.equal(info.mode & 0o777, 0o700)
    const source = await readFile(
      "local-tools/background-work-canary-control/prepare_receipt_root.ts", "utf8",
    )
    assert.match(source, /prepareReceiptRootForHome\(homedir\(\)\)/)
    assert.doesNotMatch(source, /process\.env|XDG|--path|HOME/)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test("receipt root refuses symlink and non-directory components without traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-canary-home-safety-"))
  const linkedHome = join(root, "linked-home")
  const fileHome = join(root, "file-home")
  const target = join(root, "external-target")
  try {
    await mkdir(linkedHome, { mode: 0o700 })
    await mkdir(fileHome, { mode: 0o700 })
    await mkdir(target, { mode: 0o700 })
    await symlink(target, join(linkedHome, ".local"))
    await writeFile(join(fileHome, ".local"), "not a directory", { mode: 0o600 })
    await assert.rejects(prepareReceiptRootForHome(linkedHome), /unsafe component/)
    await assert.rejects(prepareReceiptRootForHome(fileHome), /unsafe component/)
    assert.deepEqual(await readdir(target), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
