import { lstat, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { assertFinalArtifactDirectory } from "./assert_final_artifact_directory.ts"
import { FINAL_ARTIFACT_FILE,
  FINAL_ARTIFACT_INVALIDATED_FILE } from "./final_artifact_constants.ts"
import type { FinalArtifactReceipt } from "./final_artifact_types.ts"
import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import { RECEIPT_FILE } from "./receipt_constants.ts"
import { sha256Text } from "./sha256_text.ts"

export async function invalidateFinalArtifact(
  published: FinalArtifactReceipt,
): Promise<FinalArtifactReceipt> {
  const directory = dirname(published.path)
  if (published.path !== join(directory, FINAL_ARTIFACT_FILE)) {
    throw new Error("Invalid published artifact path")
  }
  await assertFinalArtifactDirectory(directory, [FINAL_ARTIFACT_FILE, RECEIPT_FILE])
  const beforeBytes = await readFile(published.path, "utf8")
  if (sha256Text(beforeBytes) !== published.sha256) {
    throw new Error("Published artifact changed before invalidation")
  }
  const before = await lstat(published.path)
  const path = join(directory, FINAL_ARTIFACT_INVALIDATED_FILE)
  await movePrivateFileExclusive(published.path, path, directory, before)
  await assertFinalArtifactDirectory(directory,
    [FINAL_ARTIFACT_INVALIDATED_FILE, RECEIPT_FILE])
  const [current, persisted] = await Promise.all([lstat(path), readFile(path, "utf8")])
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 ||
    (current.mode & 0o777) !== 0o600 || persisted !== beforeBytes ||
    sha256Text(persisted) !== published.sha256) throw new Error("Invalidation failed")
  return { artifact: published.artifact, path, sha256: published.sha256 }
}
