import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { RECEIPT_GENESIS } from "./receipt_constants.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

test("receipt appends an exact canonical durable hash chain", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-receipt-chain-"))
  try {
    const state = await initializeReceipt(root, "run-20260802-abcdef")
    assert.equal((await stat(state.directory)).mode & 0o777, 0o700)
    assert.equal((await stat(state.path)).mode & 0o777, 0o600)
    assert.equal(state.lastHash, RECEIPT_GENESIS)

    const first = await appendReceipt(state, {
      event_type: "run_started",
      timestamp_utc: "2026-08-02T00:00:00.000Z",
      metrics: { project_ref: "xtbraqnlskmqxinjxxdn", status: "started" },
    })
    assert.equal(first.sequence, 1)
    assert.equal(first.previous_hash, RECEIPT_GENESIS)
    assert.equal(
      first.current_hash,
      "fedf5b1633110946310ae2989a45f45f30d79f894c09e6d809cfb14ab7369dec",
    )

    const second = await appendReceipt(state, {
      event_type: "fast_sample",
      timestamp_utc: "2026-08-02T00:00:15.000Z",
      metrics: {
        sample_kind: "fast",
        timing: { duration_ms: 25, missed_samples: 0, overlap_count: 0 },
      },
    })
    assert.equal(second.sequence, 2)
    assert.equal(second.previous_hash, first.current_hash)
    const lines = (await readFile(state.path, "utf8")).trimEnd().split("\n")
    assert.equal(lines.length, 2)
    assert.equal(JSON.stringify(JSON.parse(lines[0])), lines[0])
    assert.deepEqual(await verifyReceiptFile(state.path), {
      count: 2,
      lastHash: second.current_hash,
      nextSequence: 3,
      size: Buffer.byteLength(`${lines.join("\n")}\n`, "utf8"),
    })

    const resumed = await initializeReceipt(root, "run-20260802-abcdef")
    assert.equal(resumed.nextSequence, 3)
    const third = await appendReceipt(resumed, {
      event_type: "run_completed",
      timestamp_utc: "2026-08-02T00:00:30.000Z",
      metrics: { status: "completed" },
    })
    assert.equal(third.sequence, 3)
    assert.equal((await verifyReceiptFile(resumed.path)).count, 3)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
