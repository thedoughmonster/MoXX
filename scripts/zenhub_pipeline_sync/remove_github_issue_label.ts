export async function removeGitHubIssueLabel(
  token: string,
  repository: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const encodedLabel = encodeURIComponent(label)
  const response = await fetch(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}/labels/${encodedLabel}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  )
  if (!response.ok) {
    throw new Error(`GitHub label removal failed with HTTP ${response.status}`)
  }
}
