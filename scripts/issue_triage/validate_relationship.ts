import { isPlainRecord } from "./is_plain_record.ts"
import { isRelationshipDirectionValid } from "./relationship_direction.ts"
import { isSafeText } from "./safe_text.ts"
import {
  relationshipDirections,
  relationshipTypes,
  type IssueRelationship,
  type RelationshipDirection,
  type RelationshipType,
} from "./types.ts"

export function validateRelationship(
  value: unknown,
  currentIssueNumber: number,
): IssueRelationship {
  const keys = ["issue_number", "type", "direction", "rationale"]
  if (
    !isPlainRecord(value) || Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) throw new Error("Invalid relationship fields")
  if (
    !Number.isInteger(value.issue_number) || Number(value.issue_number) < 1 ||
    Number(value.issue_number) > 999_999_999 ||
    value.issue_number === currentIssueNumber
  ) throw new Error("Invalid relationship reference")
  if (
    typeof value.type !== "string" ||
    !relationshipTypes.includes(value.type as RelationshipType)
  ) throw new Error("Invalid relationship type")
  if (
    typeof value.direction !== "string" ||
    !relationshipDirections.includes(value.direction as RelationshipDirection)
  ) throw new Error("Invalid relationship direction")
  if (!isRelationshipDirectionValid(
    value.type as RelationshipType,
    value.direction as RelationshipDirection,
  )) throw new Error("Relationship type and direction are incompatible")
  if (!isSafeText(value.rationale, 280)) {
    throw new Error("Invalid relationship rationale")
  }
  return value as IssueRelationship
}
