import { readdir, realpath, stat } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export async function inspectExecutionAuthorityDirectory(
  rootReal: string,
  directory: string,
): Promise<string | undefined> {
  const pending = [directory]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = await realpath(pending.pop()!)
    if (visited.has(current)) continue
    visited.add(current)
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      const targetReal = await realpath(path)
      const resolved = relative(rootReal, targetReal)
      if (resolved === ".." || resolved.startsWith(`..${sep}`)) {
        return "symlink_escape"
      }
      if (entry.isDirectory() ||
        (entry.isSymbolicLink() && (await stat(targetReal)).isDirectory())) {
        pending.push(targetReal)
      }
    }
  }
  return undefined
}
