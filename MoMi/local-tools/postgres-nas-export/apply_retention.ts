import { lstat, rm } from "node:fs/promises"
import { join } from "node:path"

import { ARCHIVES_DIRECTORY } from "./constants.ts"
import { discoverArchives } from "./discover_archives.ts"
import { selectPrunableArchives } from "./select_prunable_archives.ts"
import { verifyArchive } from "./verify_archive.ts"

export async function applyRetention(target: string, protectedArchiveId: string): Promise<string[]> {
  const removed: string[] = []
  for (const archive of selectPrunableArchives(await discoverArchives(target))) {
    if (archive.archiveId === protectedArchiveId) continue
    const archivePath = join(target, ARCHIVES_DIRECTORY, archive.archiveId)
    const info = await lstat(archivePath)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Refusing to prune unsafe archive path: ${archive.archiveId}`)
    }
    await verifyArchive(target, archive.archiveId, archive.environment, archive.projectRef)
    await rm(archivePath, { recursive: true })
    removed.push(archive.archiveId)
  }
  return removed
}
