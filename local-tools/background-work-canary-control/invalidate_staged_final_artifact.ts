import { lstat, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { assertFinalArtifactDirectory } from "./assert_final_artifact_directory.ts"
import { FINAL_ARTIFACT_INVALIDATED_FILE,
  FINAL_ARTIFACT_STAGING_FILE } from "./final_artifact_constants.ts"
import type { FinalArtifactReceipt,
  StagedFinalArtifactReceipt } from "./final_artifact_types.ts"
import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import { RECEIPT_FILE } from "./receipt_constants.ts"
import { sha256Text } from "./sha256_text.ts"

export async function invalidateStagedFinalArtifact(
  staged: StagedFinalArtifactReceipt,
): Promise<FinalArtifactReceipt> {
  const directory = dirname(staged.path)
  if (staged.path !== join(directory, FINAL_ARTIFACT_STAGING_FILE)) {
    throw new Error("Invalid staged artifact path")
  }
  await assertFinalArtifactDirectory(directory,
    [FINAL_ARTIFACT_STAGING_FILE, RECEIPT_FILE])
  const beforeBytes = await readFile(staged.path, "utf8")
  if (beforeBytes !== staged.bytes || sha256Text(beforeBytes) !== staged.sha256) {
    throw new Error("Staged artifact changed before invalidation")
  }
  const path = join(directory, FINAL_ARTIFACT_INVALIDATED_FILE)
  await movePrivateFileExclusive(staged.path, path, directory, staged.identity)
  await assertFinalArtifactDirectory(directory,
    [FINAL_ARTIFACT_INVALIDATED_FILE, RECEIPT_FILE])
  const [current, persisted] = await Promise.all([lstat(path), readFile(path, "utf8")])
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 ||
    (current.mode & 0o777) !== 0o600 || persisted !== staged.bytes ||
    sha256Text(persisted) !== staged.sha256) throw new Error("Invalidation failed")
  return { artifact: staged.artifact, path, sha256: staged.sha256 }
}
