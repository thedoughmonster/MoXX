import { randomBytes } from "node:crypto"
import { chmod, lstat, mkdir, realpath } from "node:fs/promises"
import { join } from "node:path"

import { SETUP_RECEIPT_CURRENT } from "./setup_preflight_constants.ts"
import type { SetupReceiptPaths } from "./setup_preflight_types.ts"

export async function prepareSetupReceiptPaths(root: string): Promise<SetupReceiptPaths> {
  const directory = join(root, "setup")
  try { await mkdir(directory, { mode: 0o700 }); await chmod(directory, 0o700) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  }
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink() ||
    (info.mode & 0o777) !== 0o700 || await realpath(directory) !== directory) {
    throw new Error("Setup receipt directory is unsafe")
  }
  const id = randomBytes(16).toString("hex")
  return {
    directory,
    historyPath: join(directory, `setup-${id}.json`),
    currentPath: join(directory, SETUP_RECEIPT_CURRENT),
  }
}
