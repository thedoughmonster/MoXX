import type { CompactReceipt } from "./types.ts"

export function validationExitCode(receipt: CompactReceipt): 0 | 1 {
  return receipt.counts.hard_failed === 0 ? 0 : 1
}
