import { appendFile, writeFile } from "node:fs/promises"

import { githubRequest } from "./github_request.ts"
import { loadTriageConfig } from "./load_triage_config.ts"

type GitHubIssue = {
  number: number
  title: string
  body: string | null
  state: string
  pull_request?: object
}

type GitHubComment = {
  id: number
  body: string | null
}

export async function prepareContext(): Promise<void> {
  const rawNumber = process.env.TRIAGE_ISSUE_NUMBER ?? ""
  if (!/^[1-9][0-9]{0,8}$/.test(rawNumber)) {
    throw new Error("Issue number must be a positive bounded integer")
  }
  const issueNumber = Number(rawNumber)
  const issue = await githubRequest<GitHubIssue>(`/issues/${issueNumber}`)
  if (issue.number !== issueNumber || issue.state !== "open" || issue.pull_request) {
    throw new Error("Target must be an existing open issue")
  }
  const comments = await githubRequest<GitHubComment[]>(
    `/issues/${issueNumber}/comments?per_page=20&page=1`,
  )
  const candidates = await githubRequest<GitHubIssue[]>(
    "/issues?state=open&sort=updated&direction=desc&per_page=50&page=1",
  )
  const context = {
    limits: {
      issue_body_characters: 12000,
      comments: 20,
      comment_characters_each: 1200,
      candidate_issues: 50,
      candidate_title_characters_each: 200,
    },
    issue_number: issue.number,
    triage_config: loadTriageConfig(),
    issue: {
      title: issue.title.slice(0, 256),
      body: (issue.body ?? "").slice(0, 12000),
    },
    comments: comments.map((comment) => ({
      id: comment.id,
      body: (comment.body ?? "").slice(0, 1200),
    })),
    candidate_issues: candidates.filter((candidate) =>
      !candidate.pull_request
    ).slice(0, 50).map((candidate) => ({
      issue_number: candidate.number,
      title: candidate.title.slice(0, 200),
    })),
  }
  await writeFile(
    ".github/codex/issue-context.json",
    `${JSON.stringify(context, null, 2)}\n`,
  )
  const output = process.env.GITHUB_OUTPUT
  if (!output) throw new Error("Missing GITHUB_OUTPUT")
  await appendFile(output, `issue_number=${issueNumber}\n`)
}
