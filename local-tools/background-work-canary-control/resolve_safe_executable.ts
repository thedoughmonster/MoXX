import { constants } from "node:fs"
import { access, lstat, realpath, stat } from "node:fs/promises"
import { dirname, isAbsolute } from "node:path"

export async function resolveSafeExecutable(candidate: string): Promise<string> {
  try {
    if (!isAbsolute(candidate) || candidate.includes("\0")) throw new Error()
    const resolved = await realpath(candidate)
    if (!isAbsolute(resolved)) throw new Error()
    const [file, parent] = await Promise.all([
      lstat(resolved),
      stat(dirname(resolved)),
      access(resolved, constants.X_OK),
    ])
    if (!file.isFile() || file.isSymbolicLink()) throw new Error()
    if ((file.mode & 0o022) !== 0 || (parent.mode & 0o022) !== 0) throw new Error()
    const effectiveUser = process.geteuid?.()
    if (effectiveUser !== undefined && file.uid !== 0 && file.uid !== effectiveUser) {
      throw new Error()
    }
    return resolved
  } catch {
    throw new Error("Executable path is unavailable or unsafe")
  }
}
