import { chmod, mkdir, open } from "node:fs/promises"
import { join } from "node:path"

import { assertReceiptDirectory } from "./assert_receipt_directory.ts"
import { assertReceiptFile } from "./assert_receipt_file.ts"
import { assertReceiptRoot } from "./assert_receipt_root.ts"
import { RECEIPT_FILE } from "./receipt_constants.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"
import { validateRunId } from "./validate_run_id.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

export async function initializeReceipt(root: string, runId: string): Promise<ReceiptWriterState> {
  validateRunId(runId)
  const safeRoot = await assertReceiptRoot(root)
  const directory = join(safeRoot, runId)
  const path = join(directory, RECEIPT_FILE)
  let created = false
  try {
    await mkdir(directory, { mode: 0o700 })
    created = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  }
  if (created) {
    await chmod(directory, 0o700)
    const handle = await open(path, "wx", 0o600)
    try {
      await handle.chmod(0o600)
      await handle.sync()
    } finally {
      await handle.close()
    }
    const directoryHandle = await open(directory, "r")
    try {
      await directoryHandle.sync()
    } finally {
      await directoryHandle.close()
    }
  }
  await assertReceiptDirectory(directory)
  const identity = await assertReceiptFile(path)
  const verified = await verifyReceiptFile(path)
  return {
    ...verified,
    ...identity,
    directory,
    path,
    poisoned: false,
    writing: false,
  }
}
