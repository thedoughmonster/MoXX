import type { GitHubRoadmapIssue } from "./types.ts"

export async function getGitHubRoadmapIssue(
  token: string,
  repository: string,
  issueNumber: number,
): Promise<GitHubRoadmapIssue> {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues/${issueNumber}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!response.ok) throw new Error(`GitHub issue #${issueNumber} lookup failed with HTTP ${response.status}`)
  const issue = await response.json() as GitHubRoadmapIssue
  if (issue.pull_request) throw new Error(`#${issueNumber} is a pull request, not an issue`)
  if (issue.number !== issueNumber || typeof issue.title !== "string") {
    throw new Error(`GitHub returned invalid data for issue #${issueNumber}`)
  }
  return issue
}
