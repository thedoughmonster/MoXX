import { canonicalJson } from "./canonical_json.ts"
import { CONTROL_PATTERN, SHA256_PATTERN } from "./constants.ts"
import { sha256Text } from "./sha256_text.ts"
import type { JsonObject, RepairFinding } from "./types.ts"

export function validateFindings(rows: unknown[], file: string): RepairFinding[] {
  const validated: RepairFinding[] = []
  const keys = new Set<string>()
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index]
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${file} finding ${index + 1} must be an object`)
    }
    const row = raw as Record<string, unknown>
    if (typeof row.finding_id !== "string" || row.finding_id.length === 0 ||
      CONTROL_PATTERN.test(row.finding_id) || keys.has(row.finding_id)) {
      throw new Error(`${file} has an invalid or duplicate finding_key`)
    }
    if (typeof row.category !== "string" || row.category.length === 0 ||
      typeof row.scope !== "string" || row.scope.length === 0 ||
      !row.logical_identity || typeof row.logical_identity !== "object" ||
      Array.isArray(row.logical_identity)) {
      throw new Error(`${file} finding ${index + 1} has invalid evidence`)
    }
    const finding = row as JsonObject
    const payloadText = canonicalJson(finding)
    const findingHash = sha256Text(payloadText)
    if (!SHA256_PATTERN.test(findingHash)) throw new Error(`${file} finding hash failed`)
    keys.add(row.finding_id)
    validated.push({
      ordinal: index + 1,
      finding_key: row.finding_id,
      category: row.category,
      severity: null,
      source_key: canonicalJson(row.logical_identity as JsonObject),
      finding_sha256: findingHash,
      payload_text: payloadText,
      finding,
    })
  }
  return validated
}
