import { isPlainRecord } from "./is_plain_record.ts"
import type { IssueTriage } from "./types.ts"

const markerPrefix = "<!-- momi-issue-classification:"
const marker = `${markerPrefix}v1`

export function parseDeclaredIssueType(
  currentIssueNumber: number,
  body: string,
): IssueTriage["issue_type"] | null {
  const start = body.indexOf(markerPrefix)
  if (start === -1) return null
  if (body.indexOf(markerPrefix, start + markerPrefix.length) !== -1) {
    throw new Error("Duplicate issuer classification markers")
  }
  if (!body.startsWith(marker, start)) {
    throw new Error("Unsupported issuer classification marker version")
  }
  const payloadStart = start + marker.length
  if (
    body[payloadStart] !== "\n" &&
    body.slice(payloadStart, payloadStart + 2) !== "\r\n"
  ) throw new Error("Malformed issuer classification marker")
  const end = body.indexOf("-->", payloadStart)
  if (end === -1) throw new Error("Unclosed issuer classification marker")
  const raw = body.slice(payloadStart, end).trim()
  if (raw.length > 256) throw new Error("Issuer classification declaration is too large")
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error("Malformed issuer classification JSON")
  }
  const keys = ["schema_version", "issue_number", "issue_type"]
  if (
    !isPlainRecord(value) || Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) throw new Error("Invalid issuer classification declaration fields")
  if (value.schema_version !== 1) {
    throw new Error("Unsupported issuer classification schema version")
  }
  if (value.issue_number !== currentIssueNumber) {
    throw new Error("Issuer classification references a different current issue")
  }
  if (value.issue_type !== "bug" && value.issue_type !== "feature") {
    throw new Error("Invalid issuer-declared issue type")
  }
  return value.issue_type
}
