import { open } from "node:fs/promises"

import { parseReceiptLine } from "./parse_receipt_line.ts"

export async function readReceiptStartedAt(path: string): Promise<string> {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const firstLineEnd = buffer.subarray(0, bytesRead).indexOf(0x0a)
    if (firstLineEnd < 1) throw new Error("Receipt start record is unavailable")
    const record = parseReceiptLine(buffer.subarray(0, firstLineEnd).toString("utf8"))
    if (record.event_type !== "run_started") {
      throw new Error("Receipt does not begin with run_started")
    }
    return record.timestamp_utc
  } finally {
    await handle.close()
  }
}
