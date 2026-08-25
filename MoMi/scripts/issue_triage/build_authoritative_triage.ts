import type {
  AuthoritativeTriage,
  IssueRelationship,
  IssueTriage,
} from "./types.ts"
import { loadTriageConfig } from "./load_triage_config.ts"

export function buildAuthoritativeTriage(
  triage: IssueTriage,
  declared: IssueRelationship[],
  declaredIssueType: IssueTriage["issue_type"] | null = null,
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
  const issueType = declaredIssueType ?? triage.issue_type
  return {
    ...triage,
    issue_type: issueType,
    issue_type_authority: declaredIssueType ? "issuer-declared" : "model-inferred",
    labels: [...loadTriageConfig().labels_by_issue_type[issueType]],
    relationships,
    safe_parallel: relationships.every((item) => item.type === "independent"),
  }
}
