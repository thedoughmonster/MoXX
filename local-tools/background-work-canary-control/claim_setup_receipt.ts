import { open, unlink } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { canonicalJson } from "./canonical_json.ts"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import { SETUP_RECEIPT_CURRENT } from "./setup_preflight_constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type { SetupBinding, SetupReceipt } from "./setup_preflight_types.ts"
import { verifySetupReceipt } from "./verify_setup_receipt.ts"

export async function claimSetupReceipt(
  receiptRoot: string,
  expected: SetupBinding,
  nowMs: number,
): Promise<SetupReceipt> {
  const setupDirectory = join(receiptRoot, "setup")
  const currentPath = join(setupDirectory, SETUP_RECEIPT_CURRENT)
  const receipt = verifySetupReceipt(currentPath)
  const bindingKeys = Object.keys(expected) as (keyof SetupBinding)[]
  if (bindingKeys.some((key) => receipt[key] !== expected[key])) {
    throw new SetupPreflightError("ReceiptMismatch", "receipt")
  }
  const started = Date.parse(receipt.startedAtUtc)
  const expires = Date.parse(receipt.expiresAtUtc)
  if (!Number.isFinite(started) || !Number.isFinite(expires) || expires <= started ||
    nowMs < started || nowMs > expires) {
    throw new SetupPreflightError("ReceiptExpired", "receipt")
  }
  if (dirname(receipt.receiptPath) !== setupDirectory ||
    !/^setup-[0-9a-f]{32}\.json$/.test(basename(receipt.receiptPath))) {
    throw new SetupPreflightError("ReceiptMismatch", "receipt")
  }
  let historyMatches = false
  try {
    historyMatches = verifySetupReceipt(receipt.receiptPath).receiptSha256 ===
      receipt.receiptSha256 && readBoundedRegularFile(receipt.receiptPath, 16 * 1024) ===
      readBoundedRegularFile(currentPath, 16 * 1024)
  } catch { /* sanitized mismatch below */ }
  if (!historyMatches) {
    throw new SetupPreflightError("ReceiptMismatch", "receipt")
  }
  const markerPath = join(setupDirectory, `used-${receipt.receiptSha256}.json`)
  let marker
  try { marker = await open(markerPath, "wx", 0o600) } catch {
    throw new SetupPreflightError("ReceiptReused", "receipt")
  }
  let markerFailed = false
  try {
    await marker.writeFile(`${canonicalJson({
      receiptSha256: receipt.receiptSha256,
      releaseSha: receipt.releaseSha,
      claimedAtUtc: new Date(nowMs).toISOString(),
    })}\n`)
    await marker.sync()
  } catch { markerFailed = true }
  try { await marker.close() } catch { markerFailed = true }
  if (markerFailed) throw new SetupPreflightError("ReceiptReused", "receipt")
  try { await unlink(currentPath) } catch {
    throw new SetupPreflightError("ReceiptReused", "receipt")
  }
  return receipt
}
