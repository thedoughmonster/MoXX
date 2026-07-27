export type GitHubIssue = {
  id: number
  labels: Array<string | { name: string }>
  number: number
  pull_request?: unknown
  state: "closed" | "open"
}

export async function getGitHubIssue(
  token: string,
  repository: string,
  issueNumber: number,
): Promise<GitHubIssue> {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  )
  if (!response.ok) {
    throw new Error(`GitHub issue lookup failed with HTTP ${response.status}`)
  }
  const issue = await response.json() as GitHubIssue
  if (issue.pull_request) throw new Error(`#${issueNumber} is a pull request, not an issue`)
  return issue
}
