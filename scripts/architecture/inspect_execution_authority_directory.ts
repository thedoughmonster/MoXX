import { readdir, realpath } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export async function inspectExecutionAuthorityDirectory(
  rootReal: string,
  directory: string,
): Promise<string | undefined> {
  const pending = [directory]
  while (pending.length > 0) {
    const current = pending.pop()!
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      const targetReal = await realpath(path)
      const resolved = relative(rootReal, targetReal)
      if (resolved === ".." || resolved.startsWith(`..${sep}`)) {
        return "symlink_escape"
      }
      if (entry.isDirectory()) pending.push(path)
    }
  }
  return undefined
}
