import { createHash } from "node:crypto"
import { open } from "node:fs/promises"

import { assertSafePath } from "./assert_safe_path.ts"

export async function hashSealedFile(path: string): Promise<string> {
  const safePath = await assertSafePath(path, "file")
  const handle = await open(safePath, "r")
  try {
    const metadata = await handle.stat()
    if (!metadata.isFile()) throw new Error(`Sealed path is not a file: ${path}`)
    const hash = createHash("sha256")
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      hash.update(chunk)
    }
    return hash.digest("hex")
  } finally {
    await handle.close()
  }
}
