import type { GitHubRoadmapIssue } from "./types.ts"

export async function updateGitHubRoadmapTitle(
  token: string,
  repository: string,
  issueNumber: number,
  title: string,
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues/${issueNumber}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(`GitHub issue #${issueNumber} update failed with HTTP ${response.status}`)
  const issue = await response.json() as GitHubRoadmapIssue
  if (issue.number !== issueNumber || issue.title !== title) {
    throw new Error(`GitHub did not confirm the expected title for issue #${issueNumber}`)
  }
}
