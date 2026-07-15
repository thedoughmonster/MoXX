import assert from "node:assert/strict"
import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { gzipSync } from "node:zlib"

import { createRunState } from "../local-tools/postgres-nas-export/create_run_state.ts"
import { prepareDirectories } from "../local-tools/postgres-nas-export/prepare_directories.ts"
import { publishArchive } from "../local-tools/postgres-nas-export/publish_archive.ts"
import { verifyArchive } from "../local-tools/postgres-nas-export/verify_archive.ts"
import type { CliOptions } from "../local-tools/postgres-nas-export/types.ts"

const runId = "20260714T130000000Z-fedcba654321"

async function writeStagedArtifacts(staging: string): Promise<void> {
  await writeFile(join(staging, "database.pgdump"), "custom bytes")
  await writeFile(join(staging, "source.sql.gz"), gzipSync("source SQL"))
  await writeFile(join(staging, "warehouse.sql.gz"), gzipSync("warehouse SQL"))
}

test("resumes a mixed staged and published archive without replacing bytes", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-pg-resume-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  await prepareDirectories(root)
  const options: CliOptions = {
    operation: "export",
    environment: "prod",
    projectRef: "abcdefghijklmnopqrst",
    target: root,
    dryRun: false,
  }
  const state = createRunState(options, ["toast_raw", "momi_warehouse"], runId,
    new Date("2026-07-14T13:00:00.000Z"))
  const staging = join(root, ".momi-postgres-export", "staging", runId)
  const archive = join(root, "archives", runId)
  await mkdir(staging)
  await mkdir(archive)
  await writeStagedArtifacts(staging)
  await rename(join(staging, "database.pgdump"), join(archive, "database.pgdump"))

  const first = await publishArchive(root, state, staging)
  const resumed = await publishArchive(root, state, staging)
  assert.deepEqual(resumed, first)
  assert.deepEqual((await readdir(archive)).sort(), [
    "database.pgdump", "manifest.json", "source.sql.gz", "warehouse.sql.gz",
  ])
  await verifyArchive(root, runId, "prod", "abcdefghijklmnopqrst")
})
