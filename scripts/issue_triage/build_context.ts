import type { TriageConfig } from "../dev_loop/types.ts"
import { parseDeclaredRelationships } from "./parse_declared_relationships.ts"

type Issue = { number: number; title: string; body: string | null }
type Comment = { id: number; body: string | null }
type Candidate = { number: number; title: string; pull_request?: object }

export function buildContext(
  issue: Issue,
  comments: Comment[],
  candidates: Candidate[],
  config: TriageConfig,
) {
  const limits = config.context
  const declaredRelationships = parseDeclaredRelationships(
    issue.number,
    issue.body ?? "",
  )
  const context = {
    limits,
    issue_number: issue.number,
    triage_config: {
      labels_by_issue_type: config.labels_by_issue_type,
    },
    issue: {
      title: issue.title.slice(0, 256),
      body: (issue.body ?? "").slice(0, limits.issue_body_characters),
    },
    declared_relationships: declaredRelationships,
    comments: comments.slice(0, limits.comments).map((comment) => ({
      id: comment.id,
      body: (comment.body ?? "").slice(0, limits.comment_characters_each),
    })),
    candidate_issues: candidates.filter((candidate) =>
      !candidate.pull_request
    ).slice(0, limits.candidate_issues).map((candidate) => ({
      issue_number: candidate.number,
      title: candidate.title.slice(0, limits.candidate_title_characters_each),
    })),
  }
  const text = `${JSON.stringify(context, null, 2)}\n`
  const characters = text.length
  const estimatedTokens = Math.ceil(characters / 4)
  if (estimatedTokens > limits.hard_estimated_tokens) {
    throw new Error(
      `Issue context estimate ${estimatedTokens} exceeds hard limit ` +
        `${limits.hard_estimated_tokens}`,
    )
  }
  return {
    text,
    characters,
    estimatedTokens,
    softExceeded: estimatedTokens > limits.soft_estimated_tokens,
  }
}
