import { zenhubGraphQL } from "../zenhub_pipeline_sync/zenhub_graphql.ts"

type ParentData = {
  addSubIssues: {
    failedIssues: Array<{ id: string; title: string }>
    successCount: number
  }
}

export async function setZenhubIssueParent(
  token: string,
  childIssueIds: string[],
  parentIssueId: string,
): Promise<void> {
  if (!childIssueIds.length) return
  const data = await zenhubGraphQL<ParentData>(
    token,
    `mutation ParentRoadmapIssues($childIssueIds: [ID!]!, $parentIssueId: ID!) {
      addSubIssues(input: { childIssueIds: $childIssueIds, parentId: $parentIssueId }) {
        failedIssues { id title }
        successCount
      }
    }`,
    { childIssueIds, parentIssueId },
  )
  const result = data.addSubIssues
  if (result.successCount !== childIssueIds.length || result.failedIssues.length) {
    throw new Error(`Zenhub parented ${result.successCount} of ${childIssueIds.length} requested issues`)
  }
}
