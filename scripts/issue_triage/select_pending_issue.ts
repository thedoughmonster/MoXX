import type { TriageConfig } from "../dev_loop/types.ts"
import { githubRequest } from "./github_request.ts"

type Issue = {
  number: number
  pull_request?: object
}

export async function selectPendingIssue(
  config: TriageConfig,
): Promise<number | undefined> {
  const label = encodeURIComponent(config.queue.pending_label)
  const fetched = await githubRequest<Issue[]>(
    `/issues?state=open&labels=${label}` +
      "&sort=created&direction=asc&per_page=1&page=1",
  )
  return fetched.find((issue) => !issue.pull_request)?.number
}
