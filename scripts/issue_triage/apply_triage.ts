import { buildAuthoritativeTriage } from "./build_authoritative_triage.ts"
import { buildApplyPlan } from "./build_apply_plan.ts"
import { githubPaginate } from "./github_paginate.ts"
import { githubRequest } from "./github_request.ts"
import { loadTriageConfig } from "./load_triage_config.ts"
import { parseTriage } from "./parse_triage.ts"
import { parseDeclaredRelationships } from "./parse_declared_relationships.ts"

type GitHubIssue = {
  number: number
  state: string
  body: string | null
  pull_request?: object
  labels: Array<{ name: string }>
}

type GitHubComment = {
  id: number
  body: string | null
}

export async function applyTriage(): Promise<void> {
  const rawNumber = process.env.TRIAGE_ISSUE_NUMBER ?? ""
  const output = process.env.TRIAGE_OUTPUT ?? ""
  if (!/^[1-9][0-9]{0,8}$/.test(rawNumber)) {
    throw new Error("Issue number must be a positive bounded integer")
  }
  const targetIssueNumber = Number(rawNumber)
  const triage = parseTriage(output)
  if (triage.issue_number !== targetIssueNumber) {
    throw new Error("Model output does not match the workflow issue")
  }
  const current = await githubRequest<GitHubIssue>(
    `/issues/${targetIssueNumber}`,
  )
  const declared = parseDeclaredRelationships(
    targetIssueNumber,
    current.body ?? "",
  )
  const authoritative = buildAuthoritativeTriage(triage, declared)
  const related = await Promise.all(authoritative.relationships.map((relationship) =>
    githubRequest<GitHubIssue>(`/issues/${relationship.issue_number}`)
  ))
  if (related.some((issue) => issue.pull_request || issue.state !== "open")) {
    throw new Error("Relationship references must be open issues, not pull requests")
  }
  await Promise.all(triage.labels.map((label) =>
    githubRequest(`/labels/${encodeURIComponent(label)}`)
  ))
  const comments = await githubPaginate<GitHubComment>(
    `/issues/${targetIssueNumber}/comments`,
  )
  const marker = `<!-- momi-issue-triage:v1 issue=${targetIssueNumber} -->`
  const plan = buildApplyPlan(triage, {
    targetIssueNumber,
    currentIssueNumber: current.number,
    currentIssueOpen: current.state === "open",
    currentIssueIsPullRequest: Boolean(current.pull_request),
    currentIssueBody: current.body,
    existingIssueNumbers: [current.number, ...related.map((issue) => issue.number)],
    availableLabels: [...triage.labels],
    matchingCommentIds: comments.filter((comment) =>
      comment.body?.includes(marker)
    ).map((comment) => comment.id),
  })
  const commentPath = plan.commentId
    ? `/issues/comments/${plan.commentId}`
    : `/issues/${plan.issueNumber}/comments`
  await githubRequest(commentPath, {
    method: plan.commentId ? "PATCH" : "POST",
    body: JSON.stringify({ body: plan.body }),
  })
  await githubRequest(`/issues/${plan.issueNumber}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: plan.labels }),
  })
  const pendingLabel = loadTriageConfig().queue.pending_label
  if (current.labels.some((label) => label.name === pendingLabel)) {
    await githubRequest(
      `/issues/${plan.issueNumber}/labels/${encodeURIComponent(pendingLabel)}`,
      { method: "DELETE" },
    )
  }
}
