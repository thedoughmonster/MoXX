import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { initializeReceipt } from "./initialize_receipt.ts"

test("receipt initialization rejects symlink and non-regular paths", async () => {
  const target = await mkdtemp(join(tmpdir(), "momi-receipt-target-"))
  const linkedRoot = join(tmpdir(), `momi-receipt-link-${randomUUID()}`)
  const root = await mkdtemp(join(tmpdir(), "momi-receipt-paths-"))
  const external = await mkdtemp(join(tmpdir(), "momi-receipt-external-"))
  try {
    await symlink(target, linkedRoot, "dir")
    await assert.rejects(
      initializeReceipt(linkedRoot, "run-20260802-rootlink"),
      /non-symlink|traverse/,
    )

    await symlink(external, join(root, "run-20260802-dirlink"), "dir")
    await assert.rejects(
      initializeReceipt(root, "run-20260802-dirlink"),
      /non-symlink directory/,
    )

    const fileRun = join(root, "run-20260802-filelink")
    await mkdir(fileRun, { mode: 0o700 })
    const targetFile = join(external, "target.ndjson")
    await writeFile(targetFile, "", { mode: 0o600 })
    await symlink(targetFile, join(fileRun, "receipt.ndjson"), "file")
    await assert.rejects(
      initializeReceipt(root, "run-20260802-filelink"),
      /regular non-symlink file/,
    )

    const directoryRun = join(root, "run-20260802-directory")
    await mkdir(directoryRun, { mode: 0o700 })
    await mkdir(join(directoryRun, "receipt.ndjson"), { mode: 0o600 })
    await assert.rejects(
      initializeReceipt(root, "run-20260802-directory"),
      /regular non-symlink file/,
    )

    const hardlinkRun = join(root, "run-20260802-hardlink")
    await mkdir(hardlinkRun, { mode: 0o700 })
    await link(targetFile, join(hardlinkRun, "receipt.ndjson"))
    await assert.rejects(
      initializeReceipt(root, "run-20260802-hardlink"),
      /regular non-symlink file/,
    )
  } finally {
    await rm(linkedRoot, { force: true })
    await rm(root, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
    await rm(external, { recursive: true, force: true })
  }
})
