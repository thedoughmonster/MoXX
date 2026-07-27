import type { RoadmapContract } from "./types.ts"

export function roadmapIncludesIssue(contract: RoadmapContract, issueNumber: number): boolean {
  return [contract.initiative, ...contract.projects].some(
    (entry) => entry.issue_number === issueNumber,
  )
}
