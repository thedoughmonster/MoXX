import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import type { ReceiptLineWriter } from "./receipt_types.ts"

let injectedFailure = "injected write failure"
const failDurability: ReceiptLineWriter = async () => {
  throw new Error(injectedFailure)
}

test("receipt writer poisons itself on write or fsync failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-receipt-writer-"))
  try {
    const writeState = await initializeReceipt(root, "run-20260802-writefail")
    const input = {
      event_type: "failure" as const,
      timestamp_utc: "2026-08-02T00:00:00.000Z",
      metrics: { error_class: "write_failure", status: "failed" as const },
    }
    await assert.rejects(appendReceipt(writeState, input, failDurability), /write failure/)
    assert.equal(writeState.poisoned, true)
    assert.equal(await readFile(writeState.path, "utf8"), "")
    await assert.rejects(appendReceipt(writeState, input), /writer is poisoned/)

    const fsyncState = await initializeReceipt(root, "run-20260802-fsyncfail")
    injectedFailure = "injected fsync failure"
    await assert.rejects(appendReceipt(fsyncState, input, failDurability), /fsync failure/)
    assert.equal(fsyncState.poisoned, true)
    assert.equal(await readFile(fsyncState.path, "utf8"), "")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
