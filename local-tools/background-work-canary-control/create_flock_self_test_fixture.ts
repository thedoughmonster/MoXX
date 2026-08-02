import { chmod, lstat, mkdtemp, open, realpath, rmdir, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { FlockSelfTestFixture } from "./setup_preflight_types.ts"

export async function createFlockSelfTestFixture(): Promise<FlockSelfTestFixture> {
  const directory = await mkdtemp(join(tmpdir(), "momi-canary-flock-"))
  await chmod(directory, 0o700)
  const directoryInfo = await lstat(directory)
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() ||
    (directoryInfo.mode & 0o777) !== 0o700 || await realpath(directory) !== directory) {
    throw new Error("Flock self-test fixture is unsafe")
  }
  const lockPath = join(directory, "capability.lock")
  const handle = await open(lockPath, "wx", 0o600)
  try { await handle.sync() } finally { await handle.close() }
  const lock = await lstat(lockPath)
  if (!lock.isFile() || lock.isSymbolicLink() || lock.nlink !== 1 ||
    (lock.mode & 0o777) !== 0o600) throw new Error("Flock self-test fixture is unsafe")
  return {
    directory, lockPath,
    cleanup: async () => { await unlink(lockPath); await rmdir(directory) },
  }
}
