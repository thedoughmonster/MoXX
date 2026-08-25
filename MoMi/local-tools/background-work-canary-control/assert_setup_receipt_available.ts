import { lstat } from "node:fs/promises"

import { prepareSetupReceiptPaths } from "./prepare_setup_receipt_paths.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"

export async function assertSetupReceiptAvailable(root: string): Promise<void> {
  const paths = await prepareSetupReceiptPaths(root)
  try {
    await lstat(paths.currentPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw new SetupPreflightError("SetupReceiptFailed", "receipt")
  }
  throw new SetupPreflightError("ReceiptReused", "receipt")
}
