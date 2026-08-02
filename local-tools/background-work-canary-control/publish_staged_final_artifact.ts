import { lstat, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { assertFinalArtifactDirectory } from "./assert_final_artifact_directory.ts"
import { FINAL_ARTIFACT_FILE, FINAL_ARTIFACT_INVALIDATED_FILE,
  FINAL_ARTIFACT_STAGING_FILE } from "./final_artifact_constants.ts"
import type { FinalArtifactReceipt,
  StagedFinalArtifactReceipt } from "./final_artifact_types.ts"
import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import { RECEIPT_FILE } from "./receipt_constants.ts"
import { sha256Text } from "./sha256_text.ts"

export async function publishStagedFinalArtifact(
  staged: StagedFinalArtifactReceipt,
  preservedInvalidated?: FinalArtifactReceipt,
): Promise<FinalArtifactReceipt> {
  const directory = dirname(staged.path)
  if (staged.path !== join(directory, FINAL_ARTIFACT_STAGING_FILE)) {
    throw new Error("Invalid staged artifact path")
  }
  const prefix = preservedInvalidated
    ? [FINAL_ARTIFACT_INVALIDATED_FILE, RECEIPT_FILE] : [RECEIPT_FILE]
  await assertFinalArtifactDirectory(directory, [...prefix, FINAL_ARTIFACT_STAGING_FILE])
  const stagedBytes = await readFile(staged.path, "utf8")
  if (stagedBytes !== staged.bytes || sha256Text(stagedBytes) !== staged.sha256) {
    throw new Error("Staged final artifact changed before publication")
  }
  const path = join(directory, FINAL_ARTIFACT_FILE)
  await movePrivateFileExclusive(staged.path, path, directory, staged.identity)
  await assertFinalArtifactDirectory(directory, [...prefix, FINAL_ARTIFACT_FILE])
  const [current, persisted] = await Promise.all([lstat(path), readFile(path, "utf8")])
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 ||
    current.dev !== staged.identity.dev || current.ino !== staged.identity.ino ||
    (current.mode & 0o777) !== 0o600 || persisted !== staged.bytes ||
    sha256Text(persisted) !== staged.sha256) throw new Error("Publication failed")
  return { artifact: staged.artifact, path, sha256: staged.sha256 }
}
