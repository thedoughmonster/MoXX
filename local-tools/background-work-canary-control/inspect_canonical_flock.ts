import { constants } from "node:fs"
import { access, lstat, realpath, stat } from "node:fs/promises"
import { dirname } from "node:path"

import { CANONICAL_FLOCK_PATH } from "./setup_preflight_constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type { FlockIdentity } from "./setup_preflight_types.ts"

export async function inspectCanonicalFlock(path: string): Promise<FlockIdentity> {
  try {
    if (path !== CANONICAL_FLOCK_PATH || await realpath(path) !== path) throw new Error()
    const [file, parent] = await Promise.all([
      lstat(path, { bigint: true }), stat(dirname(path), { bigint: true }),
      access(path, constants.X_OK),
    ])
    if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1n ||
      (file.mode & 0o111n) === 0n || (file.mode & 0o022n) !== 0n ||
      (parent.mode & 0o022n) !== 0n || file.uid !== 0n) throw new Error()
    return { path, device: file.dev, inode: file.ino, size: file.size }
  } catch {
    throw new SetupPreflightError("FlockUnavailable", "flock")
  }
}
