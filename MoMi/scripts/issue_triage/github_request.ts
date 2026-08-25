export async function githubRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = process.env.GH_TOKEN
  const repository = process.env.GITHUB_REPOSITORY
  if (!token || !repository) throw new Error("Missing GitHub request context")
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...init.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${path}`)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}
