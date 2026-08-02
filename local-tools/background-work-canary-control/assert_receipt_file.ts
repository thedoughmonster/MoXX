import { lstat } from "node:fs/promises"

import type { ReceiptFileIdentity } from "./receipt_types.ts"

export async function assertReceiptFile(path: string): Promise<ReceiptFileIdentity> {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
    throw new Error("Receipt path must be a regular non-symlink file")
  }
  if ((info.mode & 0o777) !== 0o600) throw new Error("Receipt file mode is unsafe")
  return { dev: info.dev, ino: info.ino, size: info.size }
}
