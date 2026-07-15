import assert from "node:assert/strict"
import { appendFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { gzipSync } from "node:zlib"

import { acquireLock } from "../local-tools/postgres-nas-export/acquire_lock.ts"
import { createRunState } from "../local-tools/postgres-nas-export/create_run_state.ts"
import { loadRunState } from "../local-tools/postgres-nas-export/load_run_state.ts"
import { prepareDirectories } from "../local-tools/postgres-nas-export/prepare_directories.ts"
import { publishArchive } from "../local-tools/postgres-nas-export/publish_archive.ts"
import { releaseLock } from "../local-tools/postgres-nas-export/release_lock.ts"
import { saveRunState } from "../local-tools/postgres-nas-export/save_run_state.ts"
import { scanDirectoryFiles } from "../local-tools/postgres-nas-export/scan_directory_files.ts"
import { stageManualExports } from "../local-tools/postgres-nas-export/stage_manual_exports.ts"
import { validateGzip } from "../local-tools/postgres-nas-export/validate_gzip.ts"
import { verifyArchive } from "../local-tools/postgres-nas-export/verify_archive.ts"
import type { CliOptions } from "../local-tools/postgres-nas-export/types.ts"

const runId = "20260714T120000000Z-abcdef123456"
const projectRef = "abcdefghijklmnopqrst"

async function writeDatabaseArtifacts(staging: string): Promise<void> {
  await writeFile(join(staging, "database.pgdump"), "synthetic custom dump bytes")
  await writeFile(join(staging, "source.sql.gz"), gzipSync("-- portable source SQL"))
  await writeFile(join(staging, "warehouse.sql.gz"), gzipSync("-- portable warehouse SQL"))
}

test("publishes every digest last and detects manual-file tampering", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-pg-archive-"))
  const manualSource = await mkdtemp(join(tmpdir(), "momi-manual-source-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  context.after(() => rm(manualSource, { recursive: true, force: true }))
  await prepareDirectories(root)
  const options: CliOptions = {
    operation: "export",
    environment: "prod",
    projectRef,
    target: root,
    dryRun: false,
    manualExportDir: manualSource,
  }
  const state = createRunState(options, ["toast_raw", "momi_warehouse"], runId,
    new Date("2026-07-14T12:00:00.000Z"))
  Object.assign(state, { PGPASSWORD: "must-not-persist" })
  const staging = join(root, ".momi-postgres-export", "staging", runId)
  await mkdir(staging)
  await writeDatabaseArtifacts(staging)
  await mkdir(join(manualSource, "reports"))
  const original = Buffer.from("untouched Toast export\r\n")
  await writeFile(join(manualSource, "reports", "orders.csv"), original)
  const scanned = await scanDirectoryFiles(manualSource, "manual")
  state.manual_files = await stageManualExports(staging, scanned.files)
  state.completed_phases.push("dumped")
  await saveRunState(root, state)
  const loaded = await loadRunState(root, runId)
  assert.deepEqual(loaded.completed_phases, ["dumped"])
  assert.equal(loaded.manual_files?.length, 1)
  const stateText = await readFile(
    join(root, ".momi-postgres-export", "runs", `${runId}.json`), "utf8",
  )
  assert.doesNotMatch(stateText, /password|pghost|pguser/i)
  assert.equal(stateText.includes(manualSource), false)

  const manifest = await publishArchive(root, state, staging)
  assert.equal(manifest.schema_version, 2)
  assert.match(manifest.dump.sha256, /^[0-9a-f]{64}$/)
  assert.match(manifest.portable_exports.source.sha256, /^[0-9a-f]{64}$/)
  assert.deepEqual(manifest.manual_files, state.manual_files)
  assert.deepEqual((await readdir(join(root, "archives", runId))).sort(), [
    "database.pgdump", "manifest.json", "manual", "source.sql.gz", "warehouse.sql.gz",
  ])
  await verifyArchive(root, runId, "prod", projectRef)
  assert.deepEqual(await readFile(join(manualSource, "reports", "orders.csv")), original)
  await appendFile(join(root, "archives", runId, "manual", "reports", "orders.csv"), "tampered")
  await assert.rejects(() => verifyArchive(root, runId, "prod", projectRef),
    /manifest was not published last|SHA-256|byte size/)
})

test("enforces one recoverable exclusive lock", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-pg-lock-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  const first = await acquireLock(root, runId)
  await assert.rejects(() => acquireLock(root, runId), /owns the exclusive lock/)
  await releaseLock(first)
  const second = await acquireLock(root, runId)
  await releaseLock(second)
})

test("rejects a portable export that is not an intact gzip stream", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-pg-gzip-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  const valid = join(root, "valid.sql.gz")
  const invalid = join(root, "invalid.sql.gz")
  await writeFile(valid, gzipSync("select 1;"))
  await writeFile(invalid, "not gzip")
  await validateGzip(valid)
  await assert.rejects(() => validateGzip(invalid))
})
