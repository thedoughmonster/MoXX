import { readFile } from "node:fs/promises"

import { assertSafePath } from "./assert_safe_path.ts"
import { sha256Bytes } from "./sha256_bytes.ts"

export async function readSealedBytes(
  path: string,
  expectedSha256?: string,
  expectedBytes?: number,
): Promise<Buffer> {
  const safePath = await assertSafePath(path, "file")
  const bytes = await readFile(safePath)
  if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) {
    throw new Error(`Sealed file byte count mismatch: ${path}`)
  }
  if (expectedSha256 !== undefined && sha256Bytes(bytes) !== expectedSha256) {
    throw new Error(`Sealed file SHA-256 mismatch: ${path}`)
  }
  return bytes
}
