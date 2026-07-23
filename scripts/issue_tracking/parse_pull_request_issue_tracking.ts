import type { IssueTracking } from "./types.ts"

export function parsePullRequestIssueTracking(body: string): IssueTracking {
  const issueMatches = [
    ...body.matchAll(/^Owning issue:\s*#([1-9][0-9]*)\s*$/gim),
  ]
  const dispositionMatches = [
    ...body.matchAll(/^Disposition:\s*(partial|complete)\s*$/gim),
  ]
  if (issueMatches.length !== 1) {
    throw new Error("PR body must contain exactly one Owning issue line")
  }
  if (dispositionMatches.length !== 1) {
    throw new Error("PR body must contain exactly one partial|complete disposition")
  }
  return {
    issueNumber: Number(issueMatches[0]?.[1]),
    disposition: dispositionMatches[0]?.[1]?.toLowerCase() as
      IssueTracking["disposition"],
  }
}
