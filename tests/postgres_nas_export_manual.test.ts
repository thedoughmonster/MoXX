import assert from "node:assert/strict"
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { REPOSITORY_ROOT } from "../local-tools/postgres-nas-export/constants.ts"
import { scanDirectoryFiles } from "../local-tools/postgres-nas-export/scan_directory_files.ts"
import { scanManualSource } from "../local-tools/postgres-nas-export/scan_manual_source.ts"
import { stageManualExports } from "../local-tools/postgres-nas-export/stage_manual_exports.ts"
import { validateArchivePath } from "../local-tools/postgres-nas-export/validate_archive_path.ts"

test("copies manual files byte-for-byte and resumes a partial temporary copy", async (context) => {
  const source = await mkdtemp(join(tmpdir(), "momi-manual-source-"))
  const staging = await mkdtemp(join(tmpdir(), "momi-manual-stage-"))
  context.after(() => rm(source, { recursive: true, force: true }))
  context.after(() => rm(staging, { recursive: true, force: true }))
  await mkdir(join(source, "nested"))
  const original = Buffer.from([0, 1, 2, 13, 10, 255])
  await writeFile(join(source, "nested", "export.bin"), original)
  const files = await scanManualSource(source, REPOSITORY_ROOT)
  await mkdir(join(staging, "manual", "nested"), { recursive: true })
  await writeFile(join(staging, "manual", "nested", "export.bin.momi-copy-next"), "partial")

  const records = await stageManualExports(staging, files)
  assert.equal(records.length, 1)
  assert.deepEqual(await readFile(join(staging, "manual", "nested", "export.bin")), original)
  assert.deepEqual(await readFile(join(source, "nested", "export.bin")), original)
  assert.deepEqual(await stageManualExports(staging, files), records)
})

test("rejects hard links and junctions anywhere in a manual tree", async (context) => {
  const hardRoot = await mkdtemp(join(tmpdir(), "momi-manual-hardlink-"))
  const junctionRoot = await mkdtemp(join(tmpdir(), "momi-manual-junction-"))
  const outside = await mkdtemp(join(tmpdir(), "momi-manual-outside-"))
  context.after(() => rm(hardRoot, { recursive: true, force: true }))
  context.after(() => rm(junctionRoot, { recursive: true, force: true }))
  context.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(join(hardRoot, "first.csv"), "bytes")
  await link(join(hardRoot, "first.csv"), join(hardRoot, "second.csv"))
  await assert.rejects(() => scanDirectoryFiles(hardRoot, "manual"), /non-linked/)
  await symlink(outside, join(junctionRoot, "linked"), process.platform === "win32" ? "junction" : "dir")
  await assert.rejects(() => scanDirectoryFiles(junctionRoot, "manual"), /links|junctions/)
})

test("rejects unsafe archive and operator source paths", async () => {
  assert.throws(() => validateArchivePath("manual/../secret.csv", "manual"), /unsafe/)
  assert.throws(() => validateArchivePath("manual/CON.txt", "manual"), /unsafe/)
  await assert.rejects(() => scanManualSource("C:\\exports:stream", REPOSITORY_ROOT), /unsafe/)
  await assert.rejects(() => scanManualSource(REPOSITORY_ROOT, REPOSITORY_ROOT), /repository/)
})
