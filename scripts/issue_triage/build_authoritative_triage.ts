import type {
  AuthoritativeTriage,
  IssueRelationship,
  IssueTriage,
} from "./types.ts"

export function buildAuthoritativeTriage(
  triage: IssueTriage,
  declared: IssueRelationship[],
): AuthoritativeTriage {
  const declaredNumbers = new Set(declared.map((item) => item.issue_number))
  const relationships = [
    ...declared.map((relationship) => ({
      ...relationship,
      authority: "issuer-declared" as const,
    })),
    ...triage.relationships.filter((relationship) =>
      !declaredNumbers.has(relationship.issue_number)
    ).map((relationship) => ({
      ...relationship,
      authority: "model-inferred" as const,
    })),
  ]
  if (relationships.length > 8) {
    throw new Error("Final relationship count exceeds the bounded maximum")
  }
  return {
    ...triage,
    relationships,
    safe_parallel: relationships.every((item) => item.type === "independent"),
  }
}
