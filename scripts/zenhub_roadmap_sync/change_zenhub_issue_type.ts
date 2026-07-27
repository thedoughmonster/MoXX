import { zenhubGraphQL } from "../zenhub_pipeline_sync/zenhub_graphql.ts"

type ChangeTypeData = {
  changeIssueTypeOfIssues: {
    failedIssues: Array<{ id: string; title: string }>
    githubErrors: string[]
    successCount: number
  }
}

export async function changeZenhubIssueType(
  token: string,
  issueIds: string[],
  issueTypeId: string,
): Promise<void> {
  if (!issueIds.length) return
  const data = await zenhubGraphQL<ChangeTypeData>(
    token,
    `mutation ChangeRoadmapIssueType($input: ChangeIssueTypeOfIssuesInput!) {
      changeIssueTypeOfIssues(input: $input) {
        failedIssues { id title }
        githubErrors
        successCount
      }
    }`,
    { input: { issueIds, issueTypeId } },
  )
  const result = data.changeIssueTypeOfIssues
  if (result.successCount !== issueIds.length || result.failedIssues.length || result.githubErrors.length) {
    throw new Error(`Zenhub changed ${result.successCount} of ${issueIds.length} requested issue types`)
  }
}
