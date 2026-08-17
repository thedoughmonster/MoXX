import { lstat, realpath } from "node:fs/promises"
import { isAbsolute, posix, relative, resolve, sep } from "node:path"

import type { PathAuthority } from "./execution_authority_types.ts"

export async function inspectExecutionAuthorityPath(
  root: string,
  authority: PathAuthority,
): Promise<string | undefined> {
  if (
    isAbsolute(authority.path) || authority.path.includes("\\") ||
    authority.path.split("/").includes("..") || /[*?\[\]{}]/.test(authority.path)
  ) return "path_escape"
  const normalized = posix.normalize(authority.path)
  if (!normalized || normalized !== authority.path || normalized === ".") {
    return "path_escape"
  }
  const rootReal = await realpath(root)
  const target = resolve(rootReal, normalized)
  const lexical = relative(rootReal, target)
  if (lexical === ".." || lexical.startsWith(`..${sep}`)) return "path_escape"
  try {
    const targetStat = await lstat(target)
    const targetReal = await realpath(target)
    const resolved = relative(rootReal, targetReal)
    if (resolved === ".." || resolved.startsWith(`..${sep}`)) {
      return "symlink_escape"
    }
    if (authority.kind === "file" && !targetStat.isFile()) return "path_kind"
    if (authority.kind === "directory" && !targetStat.isDirectory()) {
      return "path_kind"
    }
  } catch {
    return "path_missing"
  }
  return undefined
}
