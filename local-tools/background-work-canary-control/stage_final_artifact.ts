import { constants } from "node:fs"
import { lstat, open, readFile } from "node:fs/promises"
import { join } from "node:path"

import { assertFinalArtifactDirectory } from "./assert_final_artifact_directory.ts"
import { buildFinalArtifact } from "./build_final_artifact.ts"
import { canonicalJson } from "./canonical_json.ts"
import { FINAL_ARTIFACT_INVALIDATED_FILE,
  FINAL_ARTIFACT_MAX_BYTES,
  FINAL_ARTIFACT_STAGING_FILE } from "./final_artifact_constants.ts"
import type { FinalArtifactInput, FinalArtifactReceipt,
  StagedFinalArtifactReceipt } from "./final_artifact_types.ts"
import { readReceiptStartedAt } from "./read_receipt_started_at.ts"
import { RECEIPT_FILE } from "./receipt_constants.ts"
import { sha256Text } from "./sha256_text.ts"
import { syncDirectory } from "./sync_directory.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

export async function stageFinalArtifact(
  input: FinalArtifactInput,
  preservedInvalidated?: FinalArtifactReceipt,
): Promise<StagedFinalArtifactReceipt> {
  const invalidatedPath = join(input.receipt.directory, FINAL_ARTIFACT_INVALIDATED_FILE)
  if (preservedInvalidated?.path !== undefined &&
    preservedInvalidated.path !== invalidatedPath) throw new Error("Invalid artifact receipt")
  if (preservedInvalidated) {
    const [info, bytes] = await Promise.all([
      lstat(invalidatedPath), readFile(invalidatedPath, "utf8"),
    ])
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      (info.mode & 0o777) !== 0o600 ||
      sha256Text(bytes) !== preservedInvalidated.sha256) {
      throw new Error("Preserved artifact verification failed")
    }
  }
  const initialEntries = preservedInvalidated
    ? [FINAL_ARTIFACT_INVALIDATED_FILE, RECEIPT_FILE] : [RECEIPT_FILE]
  await assertFinalArtifactDirectory(input.receipt.directory, initialEntries)
  const receipt = await verifyReceiptFile(input.receipt.path)
  if (input.receipt.poisoned || receipt.lastHash !== input.receipt.lastHash ||
    receipt.count !== input.receipt.count || receipt.size !== input.receipt.size) {
    throw new Error("Receipt changed before final artifact creation")
  }
  const startedAtUtc = await readReceiptStartedAt(input.receipt.path)
  const artifact = buildFinalArtifact(input, startedAtUtc, receipt.lastHash)
  const bytes = `${canonicalJson(artifact)}\n`
  if (Buffer.byteLength(bytes, "utf8") > FINAL_ARTIFACT_MAX_BYTES) {
    throw new Error("Final artifact exceeds its byte bound")
  }
  const path = join(input.receipt.directory, FINAL_ARTIFACT_STAGING_FILE)
  const flags = constants.O_CREAT | constants.O_EXCL |
    constants.O_NOFOLLOW | constants.O_WRONLY
  const handle = await open(path, flags, 0o600)
  let identity
  try {
    await handle.chmod(0o600)
    identity = await handle.stat()
    if (!identity.isFile() || identity.nlink !== 1) throw new Error()
    await handle.writeFile(bytes, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
  await syncDirectory(input.receipt.directory)
  await assertFinalArtifactDirectory(input.receipt.directory,
    [...initialEntries, FINAL_ARTIFACT_STAGING_FILE])
  const [current, persisted] = await Promise.all([lstat(path), readFile(path, "utf8")])
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 ||
    current.dev !== identity.dev || current.ino !== identity.ino ||
    (current.mode & 0o777) !== 0o600 || persisted !== bytes) {
    throw new Error("Staged final artifact verification failed")
  }
  return { artifact, bytes, identity, path, sha256: sha256Text(persisted) }
}
