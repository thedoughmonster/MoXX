import { githubRequest } from "./github_request.ts"

export async function githubPaginate<T>(path: string): Promise<T[]> {
  const collected: T[] = []
  for (let page = 1; page <= 10; page += 1) {
    const separator = path.includes("?") ? "&" : "?"
    const items = await githubRequest<T[]>(
      `${path}${separator}per_page=100&page=${page}`,
    )
    collected.push(...items)
    if (items.length < 100) return collected
  }
  throw new Error("GitHub pagination exceeded the bounded ten-page limit")
}
