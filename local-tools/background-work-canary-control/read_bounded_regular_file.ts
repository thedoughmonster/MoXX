import { lstatSync, readFileSync } from "node:fs"
import { isAbsolute } from "node:path"

export function readBoundedRegularFile(filePath: string, maxBytes: number): string {
  if (!isAbsolute(filePath) || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Repository control-file request is invalid")
  }
  const stat = lstatSync(filePath)
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size < 1 || stat.size > maxBytes) {
    throw new Error("Repository control file is not a bounded regular file")
  }
  const bytes = readFileSync(filePath)
  if (bytes.length !== stat.size || bytes.includes(0)) {
    throw new Error("Repository control file changed or contains invalid bytes")
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}
