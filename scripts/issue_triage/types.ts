export const relationshipTypes = [
  "hard_prerequisite",
  "ordering_constraint",
  "shared_mutation_release_boundary",
  "external_user_gate",
  "independent",
] as const

export type RelationshipType = typeof relationshipTypes[number]

export const relationshipDirections = [
  "current_before_related",
  "current_after_related",
  "not_applicable",
] as const

export type RelationshipDirection = typeof relationshipDirections[number]

export type IssueRelationship = {
  issue_number: number
  type: RelationshipType
  direction: RelationshipDirection
  rationale: string
}

export type AuthoritativeRelationship = IssueRelationship & {
  authority: "issuer-declared" | "model-inferred"
}

export type IssueTriage = {
  schema_version: 1
  issue_number: number
  issue_type: "bug" | "feature"
  feature: {
    id: string
    title: string
  }
  relationships: IssueRelationship[]
  safe_parallel: boolean
  confidence: "low" | "medium" | "high"
  rationale: string
  labels: string[]
}

export type AuthoritativeTriage = Omit<IssueTriage, "relationships"> & {
  relationships: AuthoritativeRelationship[]
}

export type ApplyEvidence = {
  targetIssueNumber: number
  currentIssueNumber: number
  currentIssueOpen: boolean
  currentIssueIsPullRequest: boolean
  currentIssueBody: string | null
  existingIssueNumbers: number[]
  availableLabels: string[]
  matchingCommentIds: number[]
}

export type ApplyPlan = {
  issueNumber: number
  commentId?: number
  marker: string
  body: string
  labels: string[]
}
