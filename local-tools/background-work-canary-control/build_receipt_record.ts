import { canonicalJson } from "./canonical_json.ts"
import type { ReceiptInput, ReceiptRecord } from "./receipt_types.ts"
import { sha256Text } from "./sha256_text.ts"
import { validateReceiptInput } from "./validate_receipt_input.ts"

export function buildReceiptRecord(
  input: ReceiptInput,
  sequence: number,
  previousHash: string,
): ReceiptRecord {
  validateReceiptInput(input)
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Receipt sequence must be a positive safe integer")
  }
  if (!/^[a-f0-9]{64}$/.test(previousHash)) throw new Error("Previous hash is invalid")
  const unsigned = {
    event_type: input.event_type,
    metrics: input.metrics,
    previous_hash: previousHash,
    sequence,
    timestamp_utc: input.timestamp_utc,
  }
  return { ...unsigned, current_hash: sha256Text(canonicalJson(unsigned)) }
}
