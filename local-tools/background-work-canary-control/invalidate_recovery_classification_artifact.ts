import { lstat, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import { sha256Text } from "./sha256_text.ts"

export async function invalidateRecoveryClassificationArtifact(
  published: { path: string; sha256: string },
): Promise<void> {
  const directory = dirname(published.path)
  if (published.path !== join(directory, "classification.json")) {
    throw new Error("Classification artifact path is invalid")
  }
  const [identity, bytes] = await Promise.all([
    lstat(published.path), readFile(published.path, "utf8"),
  ])
  if (sha256Text(bytes) !== published.sha256) {
    throw new Error("Classification artifact changed before invalidation")
  }
  const invalidated = join(directory, "classification.invalidated.json")
  await movePrivateFileExclusive(published.path, invalidated, directory, identity)
  const persisted = await readFile(invalidated, "utf8")
  if (persisted !== bytes || sha256Text(persisted) !== published.sha256) {
    throw new Error("Classification artifact invalidation failed")
  }
}
