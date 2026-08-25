import { readFile } from "node:fs/promises"

import { assertReceiptFile } from "./assert_receipt_file.ts"
import { parseReceiptLine } from "./parse_receipt_line.ts"
import { RECEIPT_GENESIS } from "./receipt_constants.ts"
import type { ReceiptVerification } from "./receipt_types.ts"

export async function verifyReceiptFile(path: string): Promise<ReceiptVerification> {
  const identity = await assertReceiptFile(path)
  const contents = await readFile(path, "utf8")
  if (!contents) {
    return { count: 0, lastHash: RECEIPT_GENESIS, nextSequence: 1, size: 0 }
  }
  if (!contents.endsWith("\n")) throw new Error("Receipt file is missing its final newline")
  const lines = contents.slice(0, -1).split("\n")
  if (lines.some((line) => line.length === 0)) throw new Error("Receipt file has an empty line")
  let previousHash = RECEIPT_GENESIS
  for (let index = 0; index < lines.length; index += 1) {
    const record = parseReceiptLine(lines[index])
    if (record.sequence !== index + 1) throw new Error("Receipt sequence is broken")
    if (record.previous_hash !== previousHash) throw new Error("Receipt hash chain is broken")
    previousHash = record.current_hash
  }
  return {
    count: lines.length,
    lastHash: previousHash,
    nextSequence: lines.length + 1,
    size: identity.size,
  }
}
