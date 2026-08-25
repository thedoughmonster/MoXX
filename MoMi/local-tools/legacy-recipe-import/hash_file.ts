import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

export async function hashFile(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex")
}
