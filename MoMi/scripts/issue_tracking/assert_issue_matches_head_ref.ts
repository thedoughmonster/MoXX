import type { IssueTracking } from "./types.ts"

export function assertIssueMatchesHeadRef(
  issueIdentifier: IssueTracking["issueIdentifier"],
  headRef: string,
): void {
  const branchIssues = [
    ...headRef.matchAll(/(?:^|[^a-z0-9])(mox-[1-9][0-9]*)(?=$|[^a-z0-9])/gi),
  ].map((match) => match[1]?.toUpperCase())
  const uniqueBranchIssues = [...new Set(branchIssues)]
  if (uniqueBranchIssues.length !== 1) {
    throw new Error("PR head branch must contain exactly one Linear issue identifier")
  }
  if (uniqueBranchIssues[0] !== issueIdentifier) {
    throw new Error(
      `PR body issue ${issueIdentifier} does not match head branch issue ${uniqueBranchIssues[0]}`,
    )
  }
}
