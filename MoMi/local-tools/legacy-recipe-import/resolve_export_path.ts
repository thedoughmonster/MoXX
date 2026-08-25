import { lstat, realpath } from "node:fs/promises"
import { resolve, sep } from "node:path"

export async function resolveExportPath(
  portableRoot: string,
  relativeFile: string,
): Promise<string> {
  const root = await realpath(portableRoot)
  const candidate = resolve(portableRoot, ...relativeFile.split("/"))
  if (!candidate.startsWith(`${resolve(portableRoot)}${sep}`)) {
    throw new Error(`Export escapes portable directory: ${relativeFile}`)
  }
  const metadata = await lstat(candidate)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Export is not a regular file: ${relativeFile}`)
  }
  const actual = await realpath(candidate)
  if (!actual.startsWith(`${root}${sep}`) ||
    actual.toLowerCase() !== candidate.toLowerCase()) {
    throw new Error(`Export resolves through a link or junction: ${relativeFile}`)
  }
  return candidate
}
