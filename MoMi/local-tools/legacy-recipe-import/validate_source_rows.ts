import { canonicalJson } from "./canonical_json.ts"
import { CONTROL_PATTERN, SHA256_PATTERN } from "./constants.ts"
import { sha256Text } from "./sha256_text.ts"
import type { JsonObject, SourceRow } from "./types.ts"

export function validateSourceRows(
  rows: unknown[],
  file: string,
  orderBy: string[],
): SourceRow[] {
  const validated: SourceRow[] = []
  const keys = new Set<string>()
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index]
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${file} row ${index + 1} must be an envelope object`)
    }
    const row = raw as JsonObject
    if (orderBy.length === 0 && rows.length > 0) {
      throw new Error(`${file} needs declared primary-key ordering`)
    }
    const identity: JsonObject = {}
    for (const key of orderBy) {
      if (!Object.hasOwn(row, key)) throw new Error(`${file} is missing key ${key}`)
      identity[key] = row[key]
    }
    const sourceKey = canonicalJson(identity)
    if (CONTROL_PATTERN.test(sourceKey) || keys.has(sourceKey)) {
      throw new Error(`${file} has a duplicate source identity`)
    }
    const payloadText = canonicalJson(row)
    const rowHash = sha256Text(payloadText)
    if (!SHA256_PATTERN.test(rowHash)) throw new Error(`${file} row hash failed`)
    keys.add(sourceKey)
    validated.push({
      ordinal: index + 1, source_key: sourceKey, row_sha256: rowHash,
      payload_text: payloadText, row,
    })
  }
  return validated
}
