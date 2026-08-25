import { closeSync, openSync, readSync } from "node:fs"
import { createHash } from "node:crypto"

export function hashFile(path: string): string {
  const descriptor = openSync(path, "r")
  const digest = createHash("sha256")
  const buffer = Buffer.allocUnsafe(64 * 1024)
  try {
    let length = readSync(descriptor, buffer, 0, buffer.length, null)
    while (length > 0) {
      digest.update(buffer.subarray(0, length))
      length = readSync(descriptor, buffer, 0, buffer.length, null)
    }
  } finally {
    closeSync(descriptor)
  }
  return digest.digest("hex")
}
