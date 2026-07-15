import { lstat, mkdir } from "node:fs/promises"
import { join } from "node:path"

import { MANUAL_DIRECTORY } from "./constants.ts"
import { hashFile } from "./hash_file.ts"
import { scanDirectoryFiles } from "./scan_directory_files.ts"
import { stageManualFile } from "./stage_manual_file.ts"
import type { ArchiveFile, ScannedFile } from "./types.ts"

export async function stageManualExports(
  staging: string,
  sources: ScannedFile[],
): Promise<ArchiveFile[]> {
  const root = join(staging, MANUAL_DIRECTORY)
  await mkdir(root, { recursive: true })
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Manual staging root must be a non-link directory")
  }
  for (const source of sources) await stageManualFile(root, source)
  const scanned = await scanDirectoryFiles(root, MANUAL_DIRECTORY)
  const expected = sources.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 }))
  const actual = scanned.files.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 }))
  const directories = new Set<string>()
  for (const file of expected) {
    const parts = file.file.split("/")
    for (let index = 2; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"))
    }
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected) ||
    JSON.stringify(scanned.directories) !== JSON.stringify([...directories].sort())) {
    throw new Error("Staged manual tree does not exactly match the source tree")
  }
  for (const source of sources) {
    const info = await lstat(source.absolutePath)
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      info.size !== source.bytes || await hashFile(source.absolutePath) !== source.sha256) {
      throw new Error("Manual source changed while files were copied")
    }
  }
  return expected
}
