import { buildReceiptRecord } from "./build_receipt_record.ts"
import { canonicalJson } from "./canonical_json.ts"
import type { ReceiptInput, ReceiptRecord } from "./receipt_types.ts"

export function parseReceiptLine(line: string): ReceiptRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    throw new Error("Receipt line is not valid JSON")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Receipt line must be an object")
  }
  if (canonicalJson(parsed) !== line) throw new Error("Receipt line is not canonical JSON")
  const record = parsed as Record<string, unknown>
  if (Object.keys(record).sort().join(",") !==
      "current_hash,event_type,metrics,previous_hash,sequence,timestamp_utc") {
    throw new Error("Receipt record contains unsupported fields")
  }
  if (typeof record.current_hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.current_hash)) {
    throw new Error("Receipt current_hash is invalid")
  }
  const expected = buildReceiptRecord({
    event_type: record.event_type,
    metrics: record.metrics,
    timestamp_utc: record.timestamp_utc,
  } as ReceiptInput, record.sequence as number, record.previous_hash as string)
  if (expected.current_hash !== record.current_hash) {
    throw new Error("Receipt record hash does not match its content")
  }
  return expected
}
