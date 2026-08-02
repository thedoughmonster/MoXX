import { lstat, open } from "node:fs/promises"

import { buildSetupReceipt } from "./build_setup_receipt.ts"
import { canonicalJson } from "./canonical_json.ts"
import { prepareSetupReceiptPaths } from "./prepare_setup_receipt_paths.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type {
  SetupReceipt,
  SetupReceiptCore,
} from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"

export async function writeSetupReceipt(
  root: string,
  value: Omit<SetupReceiptCore, "receiptPath">,
): Promise<SetupReceipt> {
  try {
    const paths = await prepareSetupReceiptPaths(root)
    try { await lstat(paths.currentPath); throw new Error("unconsumed") } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    const stored = buildSetupReceipt({ ...value, receiptPath: paths.historyPath })
    const bytes = `${canonicalJson(stored)}\n`
    const history = await open(paths.historyPath, "wx", 0o600)
    try { await history.writeFile(bytes); await history.sync() } finally { await history.close() }
    const current = await open(paths.currentPath, "wx", 0o600)
    try { await current.writeFile(bytes); await current.sync() } finally { await current.close() }
    const directory = await open(paths.directory, "r")
    try { await directory.sync() } finally { await directory.close() }
    const [historyInfo, currentInfo] = await Promise.all([
      lstat(paths.historyPath), lstat(paths.currentPath),
    ])
    if (!historyInfo.isFile() || historyInfo.isSymbolicLink() || historyInfo.nlink !== 1 ||
      (historyInfo.mode & 0o777) !== 0o600 || !currentInfo.isFile() ||
      currentInfo.isSymbolicLink() || currentInfo.nlink !== 1 ||
      (currentInfo.mode & 0o777) !== 0o600) throw new Error("unsafe")
    return { ...stored, receiptSha256: sha256Text(bytes) }
  } catch {
    throw new SetupPreflightError("SetupReceiptFailed", "receipt")
  }
}
