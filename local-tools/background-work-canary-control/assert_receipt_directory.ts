import { lstat, readdir } from "node:fs/promises"

import { RECEIPT_FILE } from "./receipt_constants.ts"

export async function assertReceiptDirectory(path: string): Promise<void> {
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Receipt run path must be a non-symlink directory")
  }
  if ((info.mode & 0o777) !== 0o700) throw new Error("Receipt run directory mode is unsafe")
  const entries = await readdir(path)
  if (entries.length !== 1 || entries[0] !== RECEIPT_FILE) {
    throw new Error("Receipt run directory contains unexpected entries")
  }
}
