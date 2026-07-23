import type { ApplyEvidence, ApplyPlan, IssueTriage } from "./types.ts"
import { allowedLabels } from "./types.ts"
import { renderComment } from "./render_comment.ts"
import { validateTriage } from "./validate_triage.ts"

export function buildApplyPlan(
  candidate: unknown,
  evidence: ApplyEvidence,
): ApplyPlan {
  const triage = validateTriage(candidate)
  if (
    triage.issue_number !== evidence.targetIssueNumber ||
    triage.issue_number !== evidence.currentIssueNumber
  ) throw new Error("Triage output references a different current issue")
  if (!evidence.currentIssueOpen || evidence.currentIssueIsPullRequest) {
    throw new Error("Current reference is not an open issue")
  }
  const existing = new Set(evidence.existingIssueNumbers)
  if (!existing.has(triage.issue_number)) {
    throw new Error("Current issue reference does not exist")
  }
  if (
    triage.relationships.some((relationship) =>
      !existing.has(relationship.issue_number)
    )
  ) throw new Error("Related issue reference does not exist")
  if (
    triage.labels.some((label) =>
      !allowedLabels.includes(label) || !evidence.availableLabels.includes(label)
    )
  ) throw new Error("Requested label is not predeclared and available")
  if (evidence.matchingCommentIds.length > 1) {
    throw new Error("Ambiguous existing triage comments")
  }
  const marker = `<!-- momi-issue-triage:v1 issue=${triage.issue_number} -->`
  return {
    issueNumber: triage.issue_number,
    commentId: evidence.matchingCommentIds[0],
    marker,
    body: renderComment(triage, marker),
    labels: [...triage.labels],
  }
}
