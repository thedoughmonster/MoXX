export async function addGitHubIssueLabel(
  token: string,
  repository: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ labels: [label] }),
    },
  )
  if (!response.ok) {
    throw new Error(`GitHub label update failed with HTTP ${response.status}`)
  }
}
