import { lstat, realpath } from "node:fs/promises"
import { isAbsolute, join, relative, resolve, sep } from "node:path"

import { momiFixReceiptPath } from "./registrations.ts"
import type { FixRegistration } from "./types.ts"

export async function assertBoundedFixPaths(
  root: string,
  fix: FixRegistration,
): Promise<void> {
  const absoluteRoot = resolve(root)
  const realRoot = await realpath(absoluteRoot)
  for (const path of [...fix.outputs, momiFixReceiptPath]) {
    const absolute = resolve(absoluteRoot, path)
    const lexical = relative(absoluteRoot, absolute)
    if (lexical === ".." || lexical.startsWith(`..${sep}`) ||
      isAbsolute(lexical)) {
      throw new Error(`Fix ${fix.id} path escapes repository: ${path}`)
    }
    let candidate = absoluteRoot
    for (const component of lexical.split(sep).filter(Boolean)) {
      candidate = join(candidate, component)
      let metadata
      try {
        metadata = await lstat(candidate)
      } catch (error) {
        if (error && typeof error === "object" && "code" in error &&
          error.code === "ENOENT") break
        throw error
      }
      if (metadata.isSymbolicLink()) {
        throw new Error(`Fix ${fix.id} path contains symlink: ${path}`)
      }
      const resolved = await realpath(candidate)
      const physical = relative(realRoot, resolved)
      if (physical === ".." || physical.startsWith(`..${sep}`) ||
        isAbsolute(physical)) {
        throw new Error(`Fix ${fix.id} path escapes repository: ${path}`)
      }
    }
  }
}
