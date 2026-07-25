import { githubRequest } from "./github_request.ts"
import { loadTriageConfig } from "./load_triage_config.ts"

type Issue = {
  number: number
  state: string
  pull_request?: object
}

export async function enqueueIssue(): Promise<void> {
  const rawNumber = process.env.TRIAGE_ISSUE_NUMBER ?? ""
  if (!/^[1-9][0-9]{0,8}$/.test(rawNumber)) {
    throw new Error("Issue number must be a positive bounded integer")
  }
  const issueNumber = Number(rawNumber)
  const issue = await githubRequest<Issue>(`/issues/${issueNumber}`)
  if (issue.number !== issueNumber || issue.state !== "open" || issue.pull_request) {
    throw new Error("Target must be an existing open issue")
  }
  const label = loadTriageConfig().queue.pending_label
  await githubRequest(`/labels/${encodeURIComponent(label)}`)
  await githubRequest(`/issues/${issueNumber}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: [label] }),
  })
}
