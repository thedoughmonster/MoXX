import { appendReceipt } from "./append_receipt.ts"
import type { ReceiptInput } from "./receipt_types.ts"
import type { RecoveryState } from "./recovery_types.ts"

export async function appendRecoveryReceiptSafe(
  state: RecoveryState, input: ReceiptInput,
): Promise<boolean> {
  if (state.receipt.poisoned) return false
  try { await appendReceipt(state.receipt, input); return true } catch { return false }
}
