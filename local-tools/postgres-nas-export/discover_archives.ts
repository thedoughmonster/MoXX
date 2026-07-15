import { lstat, readdir } from "node:fs/promises"
import { join } from "node:path"

import { ARCHIVES_DIRECTORY, DUMP_FILE, MANIFEST_FILE, MANUAL_DIRECTORY, RUN_ID_PATTERN,
  SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE } from "./constants.ts"
import { readManifest } from "./read_manifest.ts"
import type { ArchiveSummary } from "./types.ts"

export async function discoverArchives(target: string): Promise<ArchiveSummary[]> {
  const root = join(target, ARCHIVES_DIRECTORY)
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Archives root is not a safe directory")
  }
  const archives: ArchiveSummary[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!RUN_ID_PATTERN.test(entry.name)) continue
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`Recognized archive path is unsafe: ${entry.name}`)
    }
    try {
      const manifestPath = join(root, entry.name, MANIFEST_FILE)
      const info = await lstat(manifestPath)
      if (!info.isFile() || info.isSymbolicLink()) {
        throw new Error("Published archive file paths are unsafe")
      }
      const manifest = await readManifest(manifestPath)
      if (manifest.archive_id !== entry.name) throw new Error("Manifest archive identity differs")
      for (const file of [DUMP_FILE, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE]) {
        const fileInfo = await lstat(join(root, entry.name, file))
        if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
          throw new Error("Published archive file paths are unsafe")
        }
      }
      if (manifest.manual_export_included) {
        const manualInfo = await lstat(join(root, entry.name, MANUAL_DIRECTORY))
        if (!manualInfo.isDirectory() || manualInfo.isSymbolicLink()) {
          throw new Error("Published manual export path is unsafe")
        }
      }
      const names = (await readdir(join(root, entry.name))).sort()
      const expected = [DUMP_FILE, MANIFEST_FILE, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE]
      if (manifest.manual_export_included) expected.push(MANUAL_DIRECTORY)
      if (JSON.stringify(names) !== JSON.stringify(expected.sort())) {
        throw new Error("Published archive contains unexpected files")
      }
      archives.push({
        archiveId: entry.name,
        createdAt: manifest.created_at,
        environment: manifest.environment,
        projectRef: manifest.project_ref,
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
  return archives
}
