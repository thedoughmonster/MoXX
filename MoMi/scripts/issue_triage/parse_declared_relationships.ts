import { isPlainRecord } from "./is_plain_record.ts"
import type { IssueRelationship } from "./types.ts"
import { validateRelationship } from "./validate_relationship.ts"

const markerPrefix = "<!-- momi-issue-relationships:"
const marker = `${markerPrefix}v1`

export function parseDeclaredRelationships(
  currentIssueNumber: number,
  body: string,
): IssueRelationship[] {
  const start = body.indexOf(markerPrefix)
  if (start === -1) return []
  if (body.indexOf(markerPrefix, start + markerPrefix.length) !== -1) {
    throw new Error("Duplicate issuer relationship markers")
  }
  if (!body.startsWith(marker, start)) {
    throw new Error("Unsupported issuer relationship marker version")
  }
  const payloadStart = start + marker.length
  if (
    body[payloadStart] !== "\n" &&
    body.slice(payloadStart, payloadStart + 2) !== "\r\n"
  ) throw new Error("Malformed issuer relationship marker")
  const end = body.indexOf("-->", payloadStart)
  if (end === -1) throw new Error("Unclosed issuer relationship marker")
  const raw = body.slice(payloadStart, end).trim()
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error("Malformed issuer relationship JSON")
  }
  const keys = ["schema_version", "issue_number", "relationships"]
  if (
    !isPlainRecord(value) || Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) throw new Error("Invalid issuer relationship declaration fields")
  if (value.schema_version !== 1) {
    throw new Error("Unsupported issuer relationship schema version")
  }
  if (value.issue_number !== currentIssueNumber) {
    throw new Error("Issuer declaration references a different current issue")
  }
  if (!Array.isArray(value.relationships) || value.relationships.length > 8) {
    throw new Error("Invalid issuer relationship count")
  }
  const relationships = value.relationships.map((relationship) =>
    validateRelationship(relationship, currentIssueNumber)
  )
  const references = relationships.map((relationship) => relationship.issue_number)
  if (new Set(references).size !== references.length) {
    throw new Error("Duplicate issuer relationship reference")
  }
  return relationships
}
