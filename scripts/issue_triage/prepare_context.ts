import { appendFile, writeFile } from "node:fs/promises"

import { buildContext } from "./build_context.ts"
import { githubRequest } from "./github_request.ts"
import { loadTriageConfig } from "./load_triage_config.ts"
import { selectPendingIssue } from "./select_pending_issue.ts"

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
  if (rawNumber && !/^[1-9][0-9]{0,8}$/.test(rawNumber)) {
    throw new Error("Issue number must be a positive bounded integer")
  }
  const config = loadTriageConfig()
  const issueNumber = rawNumber
    ? Number(rawNumber)
    : await selectPendingIssue(config)
  const output = process.env.GITHUB_OUTPUT
  if (!output) throw new Error("Missing GITHUB_OUTPUT")
  if (!issueNumber) {
    await appendFile(output, "should_triage=false\n")
    const summary = process.env.GITHUB_STEP_SUMMARY
    if (summary) await appendFile(summary, "No pending issue requires triage.\n")
    return
  }
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
  const context = buildContext(issue, comments, candidates, config)
  await writeFile(".github/codex/issue-context.json", context.text)
  await appendFile(
    output,
    `should_triage=true\nissue_number=${issueNumber}\n` +
      `context_characters=${context.characters}\n` +
      `context_estimated_tokens=${context.estimatedTokens}\n` +
      `context_soft_exceeded=${context.softExceeded}\n`,
  )
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) {
    await appendFile(
      summary,
      `Issue #${issueNumber}: ${context.characters} context characters, ` +
        `approximately ${context.estimatedTokens} tokens; ` +
        `soft limit ${config.context.soft_estimated_tokens}, ` +
        `hard limit ${config.context.hard_estimated_tokens}.\n`,
    )
  }
}
