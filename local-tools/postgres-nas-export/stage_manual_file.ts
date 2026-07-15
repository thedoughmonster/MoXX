import { constants, copyFile, lstat, mkdir, rename, unlink } from "node:fs/promises"
import { join } from "node:path"

import { hashFile } from "./hash_file.ts"
import type { ScannedFile } from "./types.ts"

export async function stageManualFile(manualRoot: string, source: ScannedFile): Promise<void> {
  const parts = source.file.split("/").slice(1)
  let parent = manualRoot
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part)
    try {
      await mkdir(parent)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
    const parentInfo = await lstat(parent)
    if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
      throw new Error("Manual staging path contains a link or non-directory")
    }
  }
  const destination = join(parent, parts.at(-1) as string)
  const temporary = `${destination}.momi-copy-next`
  let destinationInfo
  let temporaryInfo
  try { destinationInfo = await lstat(destination) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  try { temporaryInfo = await lstat(temporary) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  if (destinationInfo && temporaryInfo) throw new Error("Manual copy resume is ambiguous")
  if (destinationInfo) {
    if (!destinationInfo.isFile() || destinationInfo.isSymbolicLink() ||
      destinationInfo.nlink !== 1 || destinationInfo.size !== source.bytes ||
      await hashFile(destination) !== source.sha256) {
      throw new Error("Existing staged manual file differs from its source")
    }
    return
  }
  if (temporaryInfo) {
    if (!temporaryInfo.isFile() || temporaryInfo.isSymbolicLink() || temporaryInfo.nlink !== 1) {
      throw new Error("Temporary manual copy path is unsafe")
    }
    if (temporaryInfo.size !== source.bytes || await hashFile(temporary) !== source.sha256) {
      await unlink(temporary)
      temporaryInfo = undefined
    }
  }
  if (!temporaryInfo) await copyFile(source.absolutePath, temporary, constants.COPYFILE_EXCL)
  const sourceInfo = await lstat(source.absolutePath)
  const copiedInfo = await lstat(temporary)
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink() || sourceInfo.nlink !== 1 ||
    sourceInfo.size !== source.bytes || await hashFile(source.absolutePath) !== source.sha256 ||
    !copiedInfo.isFile() || copiedInfo.isSymbolicLink() || copiedInfo.nlink !== 1 ||
    copiedInfo.size !== source.bytes || await hashFile(temporary) !== source.sha256) {
    throw new Error("Manual source or copied bytes changed during staging")
  }
  await rename(temporary, destination)
}
