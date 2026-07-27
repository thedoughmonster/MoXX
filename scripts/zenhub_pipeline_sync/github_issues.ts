import type { GitHubIssue } from "./github_issue.ts"

export async function getGitHubIssues(
  token: string,
  repository: string,
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = []
  let page = 1
  while (true) {
    const url = new URL(`https://api.github.com/repos/${repository}/issues`)
    url.search = new URLSearchParams({
      page: String(page),
      per_page: "100",
      state: "open",
    }).toString()
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
    if (!response.ok) {
      throw new Error(`GitHub issue listing failed with HTTP ${response.status}`)
    }
    const batch = await response.json() as GitHubIssue[]
    issues.push(...batch.filter((issue) => !issue.pull_request))
    if (batch.length < 100) return issues
    page += 1
  }
}
