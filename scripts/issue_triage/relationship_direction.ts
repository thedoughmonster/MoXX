import type {
  RelationshipDirection,
  RelationshipType,
} from "./types.ts"

export function isRelationshipDirectionValid(
  type: RelationshipType,
  direction: RelationshipDirection,
): boolean {
  if (type === "hard_prerequisite") return direction === "current_after_related"
  if (type === "ordering_constraint") return direction !== "not_applicable"
  return direction === "not_applicable"
}
