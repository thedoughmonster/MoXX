export const relationshipTypes = [
  "hard_prerequisite",
  "ordering_constraint",
  "shared_mutation_release_boundary",
  "external_user_gate",
  "independent",
] as const

export type RelationshipType = typeof relationshipTypes[number]

export type IssueTriage = {
  schema_version: 1
  issue_number: number
  issue_type: "bug" | "feature"
  feature: {
    id: string
    title: string
  }
  relationships: Array<{
    issue_number: number
    type: RelationshipType
    rationale: string
  }>
  safe_parallel: boolean
  confidence: "low" | "medium" | "high"
  rationale: string
  labels: string[]
}

export type ApplyEvidence = {
  targetIssueNumber: number
  currentIssueNumber: number
  currentIssueOpen: boolean
  currentIssueIsPullRequest: boolean
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
