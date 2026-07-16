import { lstat, realpath } from "node:fs/promises"
import { resolve } from "node:path"

export async function assertSafePath(
  path: string,
  kind: "file" | "directory",
): Promise<string> {
  const absolute = resolve(path)
  const metadata = await lstat(absolute)
  const validKind = kind === "file" ? metadata.isFile() : metadata.isDirectory()
  if (!validKind || metadata.isSymbolicLink()) {
    throw new Error(`${kind} cannot be a link, junction, or reparse point: ${path}`)
  }
  const actual = await realpath(absolute)
  if (actual.toLowerCase() !== absolute.toLowerCase()) {
    throw new Error(`${kind} resolves through a link, junction, or reparse point: ${path}`)
  }
  return absolute
}
