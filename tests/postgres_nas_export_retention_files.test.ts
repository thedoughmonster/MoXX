import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { gzipSync } from "node:zlib"

import { applyRetention } from "../local-tools/postgres-nas-export/apply_retention.ts"

async function writeArchive(directory: string, archiveId: string, createdAt: string): Promise<void> {
  const dump = Buffer.from(`archive-${archiveId}`)
  const source = gzipSync(`source-${archiveId}`)
  const warehouse = gzipSync(`warehouse-${archiveId}`)
  const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex")
  await mkdir(directory)
  await writeFile(join(directory, "database.pgdump"), dump)
  await writeFile(join(directory, "source.sql.gz"), source)
  await writeFile(join(directory, "warehouse.sql.gz"), warehouse)
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify({
    schema_version: 2,
    archive_id: archiveId,
    created_at: createdAt,
    environment: "prod",
    project_ref: "abcdefghijklmnopqrst",
    postgres_major: 17,
    format: "custom",
    compression: "gzip:9",
    schemas: ["toast_raw", "momi_warehouse"],
    dump: { file: "database.pgdump", bytes: dump.length, sha256: digest(dump) },
    portable_exports: {
      source: { file: "source.sql.gz", bytes: source.length, sha256: digest(source),
        format: "plain-sql", compression: "gzip:9", schemas: ["toast_raw"] },
      warehouse: { file: "warehouse.sql.gz", bytes: warehouse.length,
        sha256: digest(warehouse), format: "plain-sql", compression: "gzip:9",
        schemas: ["momi_warehouse"] },
    },
    manual_export_included: false,
    manual_files: [],
  }, null, 2)}\n`)
}

test("never prunes the just-published multi-artifact archive", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-pg-retention-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  const archiveRoot = join(root, "archives")
  await mkdir(archiveRoot)
  const ids: string[] = []
  for (let index = 0; index < 35; index += 1) {
    const createdAt = new Date(Date.UTC(2026, 6, 14, 12, 0, index)).toISOString()
    const archiveId = `${createdAt.replace(/[-:.]/g, "")}-${index.toString(16).padStart(12, "0")}`
    ids.push(archiveId)
    await writeArchive(join(archiveRoot, archiveId), archiveId, createdAt)
  }
  const removed = await applyRetention(root, ids[0])
  assert.equal(removed.length, 33)
  await access(join(archiveRoot, ids[0]))
  await access(join(archiveRoot, ids[34]))
  await assert.rejects(() => access(join(archiveRoot, ids[1])), /ENOENT/)
})
