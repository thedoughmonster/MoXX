import { open, lstat, realpath } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"

import { CANARY_LOCK_FILENAME } from "./process_constants.ts"

export async function prepareCanaryLockFile(
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  try {
    const runtimeDirectory = environment.XDG_RUNTIME_DIR || "/tmp"
    if (!isAbsolute(runtimeDirectory) || runtimeDirectory.includes("\0")) {
      throw new Error()
    }
    const [directory, actualDirectory] = await Promise.all([
      lstat(runtimeDirectory),
      realpath(runtimeDirectory),
    ])
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error()
    if (actualDirectory !== resolve(runtimeDirectory)) throw new Error()
    const effectiveUser = process.geteuid?.()
    if (actualDirectory === "/tmp") {
      if ((directory.mode & 0o1000) === 0) throw new Error()
    } else if ((directory.mode & 0o077) !== 0 ||
      (effectiveUser !== undefined && directory.uid !== effectiveUser)) {
      throw new Error()
    }
    const lockPath = join(runtimeDirectory, CANARY_LOCK_FILENAME)
    try {
      const created = await open(lockPath, "wx", 0o600)
      await created.close()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
    const lock = await lstat(lockPath)
    if (!lock.isFile() || lock.isSymbolicLink() || lock.nlink !== 1) throw new Error()
    if ((lock.mode & 0o777) !== 0o600) throw new Error()
    if (effectiveUser !== undefined && lock.uid !== effectiveUser) throw new Error()
    return lockPath
  } catch {
    throw new Error("Canary control lock path is unavailable or unsafe")
  }
}
