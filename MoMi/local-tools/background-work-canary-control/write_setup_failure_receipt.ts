import { lstat, open } from "node:fs/promises"

import { canonicalJson } from "./canonical_json.ts"
import { prepareSetupReceiptPaths } from "./prepare_setup_receipt_paths.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type {
  SetupFailureReceipt,
  SetupFailureReceiptCore,
} from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"

export async function writeSetupFailureReceipt(
  root: string,
  value: Omit<SetupFailureReceiptCore, "receiptPath">,
): Promise<SetupFailureReceipt> {
  try {
    const paths = await prepareSetupReceiptPaths(root)
    const core = { ...value, receiptPath: paths.historyPath }
    const integritySha256 = sha256Text(canonicalJson(core))
    const bytes = `${canonicalJson({ ...core, integritySha256 })}\n`
    const handle = await open(paths.historyPath, "wx", 0o600)
    try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
    const info = await lstat(paths.historyPath)
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      (info.mode & 0o777) !== 0o600) throw new Error()
    return { ...core, integritySha256, receiptSha256: sha256Text(bytes) }
  } catch {
    throw new SetupPreflightError("SetupReceiptFailed", "receipt")
  }
}
