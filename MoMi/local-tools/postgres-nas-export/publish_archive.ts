import { randomUUID } from "node:crypto"
import { lstat, mkdir, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { buildArchiveManifest } from "./build_archive_manifest.ts"
import { ARCHIVES_DIRECTORY, DUMP_FILE, MANIFEST_FILE, MANUAL_DIRECTORY,
  SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE } from "./constants.ts"
import { publishStagedPath } from "./publish_staged_path.ts"
import { readManifest } from "./read_manifest.ts"
import type { DumpManifest, RunState } from "./types.ts"

export async function publishArchive(
  target: string,
  state: RunState,
  staging: string,
): Promise<DumpManifest> {
  const archivePath = join(target, ARCHIVES_DIRECTORY, state.archive_id)
  await mkdir(archivePath, { recursive: true })
  const archiveInfo = await lstat(archivePath)
  if (!archiveInfo.isDirectory() || archiveInfo.isSymbolicLink()) {
    throw new Error("Archive destination must be a non-link directory")
  }
  for (const file of [DUMP_FILE, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE]) {
    await publishStagedPath(join(staging, file), join(archivePath, file), "file")
  }
  const stagedManual = join(staging, MANUAL_DIRECTORY)
  const publishedManual = join(archivePath, MANUAL_DIRECTORY)
  if (state.manual_exports) {
    await publishStagedPath(stagedManual, publishedManual, "directory")
  } else {
    for (const path of [stagedManual, publishedManual]) {
      try {
        await lstat(path)
        throw new Error("Manual export path exists for a run that excluded manual files")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
    }
  }
  const manifest = await buildArchiveManifest(archivePath, state)
  const manifestPath = join(archivePath, MANIFEST_FILE)
  try {
    const info = await lstat(manifestPath)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Published manifest path is unsafe")
    const existing = await readManifest(manifestPath)
    if (JSON.stringify(existing) !== JSON.stringify(manifest)) {
      throw new Error("Existing published manifest does not match resumed export")
    }
    return existing
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const temporary = join(staging, `manifest.${randomUUID()}.next`)
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  })
  await rename(temporary, manifestPath)
  return manifest
}
