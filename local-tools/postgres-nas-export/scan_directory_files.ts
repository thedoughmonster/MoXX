import { lstat, readdir, realpath } from "node:fs/promises"
import { join, resolve } from "node:path"

import { hashFile } from "./hash_file.ts"
import type { ScannedTree } from "./types.ts"

export async function scanDirectoryFiles(directory: string, prefix: string): Promise<ScannedTree> {
  const rootInfo = await lstat(directory)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Scanned directory must be a regular non-link directory")
  }
  const resolvedRoot = (await realpath(directory))
    .replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "")
  const expectedRoot = resolve(directory)
    .replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "")
  const actualRoot = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot
  const comparedRoot = process.platform === "win32" ? expectedRoot.toLowerCase() : expectedRoot
  if (actualRoot !== comparedRoot) throw new Error("Scanned directory resolves through a link or junction")

  const files: ScannedTree["files"] = []
  const directories: string[] = []
  const pending = [{ absolute: directory, portable: prefix }]
  while (pending.length > 0) {
    const current = pending.pop() as { absolute: string; portable: string }
    for (const entry of await readdir(current.absolute, { withFileTypes: true })) {
      const base = entry.name.split(".", 1)[0]
      if (!entry.name || entry.name === "." || entry.name === ".." ||
        /[\x00-\x1f<>:"|?*\\/]/.test(entry.name) || entry.name.endsWith(".") ||
        entry.name.endsWith(" ") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) {
        throw new Error("Scanned directory contains an unsafe Windows path segment")
      }
      const absolute = join(current.absolute, entry.name)
      const portable = current.portable ? `${current.portable}/${entry.name}` : entry.name
      const before = await lstat(absolute)
      if (before.isSymbolicLink()) throw new Error("Manual and archive trees cannot contain links or junctions")
      const resolved = (await realpath(absolute))
        .replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "")
      const expected = resolve(absolute)
        .replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "")
      const actual = process.platform === "win32" ? resolved.toLowerCase() : resolved
      const compared = process.platform === "win32" ? expected.toLowerCase() : expected
      if (actual !== compared) throw new Error("Manual and archive paths cannot traverse junctions")
      if (before.isDirectory()) {
        directories.push(portable)
        pending.push({ absolute, portable })
        continue
      }
      if (!before.isFile() || before.nlink !== 1) {
        throw new Error("Manual and archive entries must be regular non-linked files")
      }
      const sha256 = await hashFile(absolute)
      const after = await lstat(absolute)
      if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1 ||
        after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs || after.ino !== before.ino || after.dev !== before.dev) {
        throw new Error("File changed while it was being scanned")
      }
      files.push({ file: portable, bytes: after.size, sha256, absolutePath: absolute,
        modifiedMs: after.mtimeMs })
    }
  }
  files.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0)
  directories.sort()
  const folded = files.map((file) => file.file.toLowerCase())
  if (new Set(folded).size !== folded.length) throw new Error("Archive paths collide by case")
  return { files, directories }
}
