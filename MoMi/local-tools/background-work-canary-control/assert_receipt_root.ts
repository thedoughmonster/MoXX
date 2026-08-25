import { lstat, realpath } from "node:fs/promises"
import { resolve } from "node:path"

export async function assertReceiptRoot(root: string): Promise<string> {
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Receipt root must be an existing non-symlink directory")
  }
  const expected = resolve(root)
  const actual = await realpath(root)
  if (actual !== expected) throw new Error("Receipt root cannot traverse a symlink")
  return expected
}
