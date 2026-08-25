import { randomUUID } from "node:crypto"
import { lstat, open, readFile, unlink } from "node:fs/promises"
import { hostname } from "node:os"
import { join } from "node:path"

import { LOCK_FILE } from "./constants.ts"
import type { LockHandle } from "./types.ts"

export async function acquireLock(target: string, runId: string): Promise<LockHandle> {
  const path = join(target, LOCK_FILE)
  const token = randomUUID()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, "wx", 0o600)
      try {
        await handle.writeFile(`${JSON.stringify({
          schema_version: 1,
          run_id: runId,
          pid: process.pid,
          hostname: hostname(),
          token,
          acquired_at: new Date().toISOString(),
        }, null, 2)}\n`)
      } finally {
        await handle.close()
      }
      return { path, token }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "EEXIST" || attempt > 0) throw error
      const lockInfo = await lstat(path)
      if (!lockInfo.isFile() || lockInfo.isSymbolicLink()) {
        throw new Error(`Exclusive lock path is unsafe: ${path}`)
      }
      const first = await readFile(path, "utf8")
      let existing: { pid?: unknown; hostname?: unknown }
      try {
        existing = JSON.parse(first) as { pid?: unknown; hostname?: unknown }
      } catch {
        throw new Error(`Exclusive lock is unreadable and must be inspected manually: ${path}`)
      }
      if (existing.hostname !== hostname() || !Number.isInteger(existing.pid)) {
        throw new Error(`Another workstation owns the exclusive lock: ${path}`)
      }
      try {
        process.kill(existing.pid as number, 0)
        throw new Error(`Another local process owns the exclusive lock: ${path}`)
      } catch (probe) {
        if ((probe as NodeJS.ErrnoException).code !== "ESRCH") throw probe
      }
      if (await readFile(path, "utf8") !== first) {
        throw new Error("Exclusive lock changed while checking its owner")
      }
      await unlink(path)
    }
  }
  throw new Error("Exclusive lock could not be acquired")
}
