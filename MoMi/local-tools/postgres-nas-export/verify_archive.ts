import { lstat } from "node:fs/promises"
import { join } from "node:path"

import { ARCHIVES_DIRECTORY, DUMP_FILE, MANIFEST_FILE, MANUAL_DIRECTORY,
  RUN_ID_PATTERN, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE } from "./constants.ts"
import { readManifest } from "./read_manifest.ts"
import { scanDirectoryFiles } from "./scan_directory_files.ts"
import type { ArchiveFile, EnvironmentName, VerifiedArchive } from "./types.ts"

export async function verifyArchive(
  target: string,
  archiveId: string,
  environment: EnvironmentName,
  projectRef: string,
): Promise<VerifiedArchive> {
  if (!RUN_ID_PATTERN.test(archiveId)) throw new Error("Archive identifier is unsafe")
  const archiveRoot = join(target, ARCHIVES_DIRECTORY)
  const archivePath = join(archiveRoot, archiveId)
  const manifestPath = join(archivePath, MANIFEST_FILE)
  for (const path of [archiveRoot, archivePath]) {
    const info = await lstat(path)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error("Archive paths must be regular non-link directories")
    }
  }
  const manifestInfo = await lstat(manifestPath)
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink()) {
    throw new Error("Archive manifest path is unsafe")
  }
  const manifest = await readManifest(manifestPath)
  if (manifest.archive_id !== archiveId || manifest.environment !== environment ||
    manifest.project_ref !== projectRef) {
    throw new Error("Archive manifest does not match the requested archive")
  }
  const records: ArchiveFile[] = [
    manifest.dump,
    manifest.portable_exports.source,
    manifest.portable_exports.warehouse,
    ...manifest.manual_files,
  ]
  const expectedFiles = [...records.map((record) => record.file), MANIFEST_FILE].sort()
  const expectedDirectories = new Set<string>()
  if (manifest.manual_export_included) expectedDirectories.add(MANUAL_DIRECTORY)
  for (const record of manifest.manual_files) {
    const parts = record.file.split("/")
    for (let index = 2; index < parts.length; index += 1) {
      expectedDirectories.add(parts.slice(0, index).join("/"))
    }
  }
  const tree = await scanDirectoryFiles(archivePath, "")
  if (JSON.stringify(tree.files.map((file) => file.file)) !== JSON.stringify(expectedFiles) ||
    JSON.stringify(tree.directories) !== JSON.stringify([...expectedDirectories].sort())) {
    throw new Error("Published archive contains missing or unexpected paths")
  }
  const found = new Map(tree.files.map((file) => [file.file, file]))
  for (const record of records) {
    const actual = found.get(record.file)
    if (!actual || actual.bytes !== record.bytes || actual.sha256 !== record.sha256) {
      throw new Error(`Archive SHA-256 or byte size does not match: ${record.file}`)
    }
    if (manifestInfo.mtimeMs < actual.modifiedMs) {
      throw new Error("Archive manifest was not published last")
    }
  }
  return {
    dumpPath: join(archivePath, DUMP_FILE),
    sourcePath: join(archivePath, SOURCE_EXPORT_FILE),
    warehousePath: join(archivePath, WAREHOUSE_EXPORT_FILE),
    manifest,
  }
}
