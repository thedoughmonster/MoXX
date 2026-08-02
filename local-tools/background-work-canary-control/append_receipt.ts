import { appendAndSync } from "./append_and_sync.ts"
import { assertReceiptFile } from "./assert_receipt_file.ts"
import { buildReceiptRecord } from "./build_receipt_record.ts"
import { canonicalJson } from "./canonical_json.ts"
import type {
  ReceiptInput,
  ReceiptLineWriter,
  ReceiptRecord,
  ReceiptWriterState,
} from "./receipt_types.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

export async function appendReceipt(
  state: ReceiptWriterState,
  input: ReceiptInput,
  writeLine: ReceiptLineWriter = appendAndSync,
): Promise<ReceiptRecord> {
  if (state.poisoned) throw new Error("Receipt writer is poisoned")
  if (state.writing) throw new Error("Receipt writer already has an append in progress")
  state.writing = true
  try {
    const before = await assertReceiptFile(state.path)
    if (before.dev !== state.dev || before.ino !== state.ino || before.size !== state.size) {
      throw new Error("Receipt file identity changed before append")
    }
    const verified = await verifyReceiptFile(state.path)
    if (verified.nextSequence !== state.nextSequence || verified.lastHash !== state.lastHash) {
      throw new Error("Receipt chain changed before append")
    }
    const record = buildReceiptRecord(input, state.nextSequence, state.lastHash)
    const line = `${canonicalJson(record)}\n`
    await writeLine(state.path, line)
    const after = await assertReceiptFile(state.path)
    if (after.dev !== state.dev || after.ino !== state.ino ||
        after.size !== state.size + Buffer.byteLength(line, "utf8")) {
      throw new Error("Receipt append did not produce the exact expected file")
    }
    const final = await verifyReceiptFile(state.path)
    if (final.lastHash !== record.current_hash || final.nextSequence !== state.nextSequence + 1) {
      throw new Error("Receipt append did not produce the expected chain")
    }
    state.size = after.size
    state.count = final.count
    state.lastHash = final.lastHash
    state.nextSequence = final.nextSequence
    return record
  } catch (error) {
    state.poisoned = true
    throw error
  } finally {
    state.writing = false
  }
}
