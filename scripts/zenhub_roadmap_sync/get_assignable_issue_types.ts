import { zenhubGraphQL } from "../zenhub_pipeline_sync/zenhub_graphql.ts"
import type { ZenhubIssueType } from "./types.ts"

type IssueTypesData = {
  node: null | { assignableIssueTypes: { nodes: ZenhubIssueType[] } }
}

export async function getAssignableIssueTypes(
  token: string,
  workspaceId: string,
  repositoryId: string,
): Promise<ZenhubIssueType[]> {
  const data = await zenhubGraphQL<IssueTypesData>(
    token,
    `query RoadmapIssueTypes($repositoryId: ID!, $workspaceId: ID!) {
      node(id: $repositoryId) {
        ... on Repository {
          assignableIssueTypes(workspaceId: $workspaceId) {
            nodes {
              ... on GithubIssueType { id name }
              ... on ZenhubIssueType { id name }
            }
          }
        }
      }
    }`,
    { repositoryId, workspaceId },
  )
  if (!data.node) throw new Error(`Zenhub repository ${repositoryId} was not found`)
  return data.node.assignableIssueTypes.nodes
}
