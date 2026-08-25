import { lstat, realpath } from "node:fs/promises"
import { win32 } from "node:path"

export async function assertSafeTarget(target: string, repositoryRoot: string): Promise<void> {
  const targetInfo = await lstat(target)
  if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) {
    throw new Error("--target must be an existing non-symlink directory")
  }
  const parsed = win32.parse(target)
  let cursor = parsed.root
  const segments = target.slice(parsed.root.length).split("\\").filter(Boolean)
  const rootInfo = await lstat(cursor)
  if (rootInfo.isSymbolicLink()) throw new Error("UNC share root cannot be a symlink")
  for (const segment of segments) {
    cursor = win32.join(cursor, segment)
    const info = await lstat(cursor)
    if (info.isSymbolicLink()) throw new Error("--target cannot traverse a symlink or junction")
  }
  const resolvedTarget = (await realpath(target))
    .replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "")
  const expected = win32.normalize(target).replace(/\\+$/, "").toLowerCase()
  const actual = win32.normalize(resolvedTarget).replace(/\\+$/, "").toLowerCase()
  if (actual !== expected) throw new Error("--target resolves through an unexpected path")
  const resolvedRepository = await realpath(repositoryRoot)
  const relative = win32.relative(resolvedRepository, resolvedTarget)
  if (relative === "" || (!relative.startsWith("..") && !win32.isAbsolute(relative))) {
    throw new Error("--target cannot resolve to the repository")
  }
}
