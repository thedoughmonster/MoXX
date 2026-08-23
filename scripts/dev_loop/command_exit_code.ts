import type { CompactReceipt } from "./types.ts"

export function commandExitCode(receipt: CompactReceipt): number {
  return receipt.commands.find((item) =>
    item.enforcement === "hard_stop" && item.status !== 0
  )?.status ?? 0
}
