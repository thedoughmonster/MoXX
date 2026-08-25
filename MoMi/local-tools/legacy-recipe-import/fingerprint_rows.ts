import { sha256Text } from "./sha256_text.ts"
import type { FingerprintRow } from "./types.ts"

export function fingerprintRows(rows: FingerprintRow[]): string {
  return sha256Text(rows.map((row) =>
    `${row.ordinal}\t${row.key}\t${row.sha256}\n`
  ).join(""))
}
