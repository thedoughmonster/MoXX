import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { buildReceiptRecord } from "./build_receipt_record.ts"
import { canonicalJson } from "./canonical_json.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

test("receipt verification rejects tampering and broken order or hashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-receipt-integrity-"))
  try {
    const state = await initializeReceipt(root, "run-20260802-integrity")
    const first = await appendReceipt(state, {
      event_type: "run_started",
      timestamp_utc: "2026-08-02T00:00:00.000Z",
      metrics: { status: "started" },
    })
    await appendReceipt(state, {
      event_type: "fast_sample",
      timestamp_utc: "2026-08-02T00:00:15.000Z",
      metrics: { duration_ms: 25, sample_kind: "fast" },
    })
    const valid = await readFile(state.path, "utf8")

    await writeFile(state.path, valid.replace('"duration_ms":25', '"duration_ms":26'))
    await assert.rejects(verifyReceiptFile(state.path), /hash does not match/)

    const lines = valid.trimEnd().split("\n")
    const reordered = buildReceiptRecord({
      event_type: "fast_sample",
      timestamp_utc: "2026-08-02T00:00:15.000Z",
      metrics: { duration_ms: 25, sample_kind: "fast" },
    }, 3, first.current_hash)
    await writeFile(state.path, `${lines[0]}\n${canonicalJson(reordered)}\n`)
    await assert.rejects(verifyReceiptFile(state.path), /sequence is broken/)

    const broken = JSON.parse(lines[1]) as Record<string, unknown>
    const hash = String(broken.current_hash)
    broken.current_hash = `${hash[0] === "0" ? "1" : "0"}${hash.slice(1)}`
    await writeFile(state.path, `${lines[0]}\n${canonicalJson(broken)}\n`)
    await assert.rejects(verifyReceiptFile(state.path), /hash does not match/)

    await writeFile(state.path, valid)
    state.size = Buffer.byteLength(valid, "utf8")
    await writeFile(state.path, valid.replace('"status":"started"', '"status":"stopped"'))
    await assert.rejects(
      appendReceipt(state, {
        event_type: "run_completed",
        timestamp_utc: "2026-08-02T00:00:30.000Z",
        metrics: { status: "completed" },
      }),
      /hash does not match/,
    )
    assert.equal(state.poisoned, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
