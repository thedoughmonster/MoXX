import { existsSync } from "node:fs"

import { hashFile } from "./hash_file.ts"
import { hashText } from "./hash_text.ts"

export function hashEvidence(inline: string | undefined, path: string | undefined): string {
  if (inline) return hashText(inline)
  if (path && existsSync(path)) return hashFile(path)
  return hashText("")
}
