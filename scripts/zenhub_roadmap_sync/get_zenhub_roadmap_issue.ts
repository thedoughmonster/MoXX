import { zenhubGraphQL } from "../zenhub_pipeline_sync/zenhub_graphql.ts"
import type { ZenhubRoadmapIssue } from "./types.ts"

type IssueData = { issueByInfo: null | ZenhubRoadmapIssue }

export async function getZenhubRoadmapIssue(
  token: string,
  repositoryGhId: number,
  issueNumber: number,
): Promise<ZenhubRoadmapIssue> {
  const data = await zenhubGraphQL<IssueData>(
    token,
    `query RoadmapIssue($repositoryGhId: Int!, $issueNumber: Int!) {
      issueByInfo(repositoryGhId: $repositoryGhId, issueNumber: $issueNumber) {
        id
        number
        issueType {
          ... on GithubIssueType { id name }
          ... on ZenhubIssueType { id name }
        }
        parentIssue { id number }
      }
    }`,
    { issueNumber, repositoryGhId },
  )
  if (!data.issueByInfo) throw new Error(`Zenhub could not resolve issue #${issueNumber}`)
  if (data.issueByInfo.number !== issueNumber) {
    throw new Error(`Zenhub returned the wrong issue for #${issueNumber}`)
  }
  return data.issueByInfo
}
