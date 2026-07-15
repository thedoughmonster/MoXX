import { lstat, readFile, unlink } from "node:fs/promises"

import type { LockHandle } from "./types.ts"

export async function releaseLock(lock: LockHandle): Promise<void> {
  const info = await lstat(lock.path)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Exclusive lock path is unsafe")
  const source = await readFile(lock.path, "utf8")
  const parsed = JSON.parse(source) as { token?: unknown }
  if (parsed.token !== lock.token) throw new Error("Exclusive lock ownership changed")
  await unlink(lock.path)
}
