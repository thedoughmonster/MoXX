import { link, lstat, unlink } from "node:fs/promises"
import { dirname } from "node:path"

import type { FinalArtifactFileIdentity } from "./final_artifact_types.ts"
import { syncDirectory } from "./sync_directory.ts"

export async function movePrivateFileExclusive(
  source: string,
  destination: string,
  directory: string,
  identity: FinalArtifactFileIdentity,
): Promise<void> {
  if (source === destination || dirname(source) !== directory ||
    dirname(destination) !== directory) throw new Error("Unsafe artifact move")
  const before = await lstat(source)
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 ||
    before.dev !== identity.dev || before.ino !== identity.ino ||
    (before.mode & 0o777) !== 0o600) throw new Error("Unsafe artifact source")
  await link(source, destination)
  try {
    const [linkedSource, linkedDestination] = await Promise.all([
      lstat(source), lstat(destination),
    ])
    if (!linkedSource.isFile() || linkedSource.isSymbolicLink() ||
      !linkedDestination.isFile() || linkedDestination.isSymbolicLink() ||
      linkedSource.nlink !== 2 || linkedDestination.nlink !== 2 ||
      linkedSource.dev !== identity.dev || linkedSource.ino !== identity.ino ||
      linkedDestination.dev !== identity.dev || linkedDestination.ino !== identity.ino ||
      (linkedDestination.mode & 0o777) !== 0o600) throw new Error()
    await unlink(source)
  } catch (error) {
    try {
      const rollback = await lstat(destination)
      if (rollback.dev === identity.dev && rollback.ino === identity.ino) {
        await unlink(destination)
      }
    } catch { /* preserve every path when rollback identity is uncertain */ }
    await syncDirectory(directory)
    throw error
  }
  await syncDirectory(directory)
  const current = await lstat(destination)
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 ||
    current.dev !== identity.dev || current.ino !== identity.ino ||
    (current.mode & 0o777) !== 0o600) throw new Error("Artifact move failed")
}
