import type { IssueTracking } from "./types.ts"

export function parsePullRequestIssueTracking(body: string): IssueTracking {
  const issueMatches = [
    ...body.matchAll(/^Owning Linear issue:\s*(MOX-[1-9][0-9]*)\s*$/gim),
  ]
  if (issueMatches.length !== 1) {
    throw new Error("PR body must contain exactly one Owning Linear issue line")
  }
  return {
    issueIdentifier: issueMatches[0]?.[1]?.toUpperCase() as
      IssueTracking["issueIdentifier"],
  }
}
