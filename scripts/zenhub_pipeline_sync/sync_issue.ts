import { addGitHubIssueLabel } from "./add_github_issue_label.ts"
import type { GitHubIssue } from "./github_issue.ts"
import { removeGitHubIssueLabel } from "./remove_github_issue_label.ts"
import { selectPipeline } from "./select_pipeline.ts"
import { zenhubGraphQL } from "./zenhub_graphql.ts"

type SyncIssueInput = {
  defaultLabel: string
  githubIssue: GitHubIssue
  githubToken: string
  pipelineMap: Readonly<Record<string, string>>
  repository: string
  repositoryGhId: number
  workspaceId: string
  zenhubToken: string
}

type IssueData = {
  issueByInfo: null | {
    id: string
    pipelineIssue: null | { pipeline: null | { id: string; name: string } }
  }
}

type MoveData = {
  moveIssue: { issue: { pipelineIssue: { pipeline: { id: string; name: string } } } }
}

export async function syncIssue(input: SyncIssueInput): Promise<string> {
  const labels = input.githubIssue.labels.map((label) =>
    typeof label === "string" ? label : label.name
  )
  if (input.githubIssue.state === "closed") {
    const statusLabels = labels.filter((label) => label.startsWith("status:"))
    await Promise.all(statusLabels.map((label) =>
      removeGitHubIssueLabel(
        input.githubToken,
        input.repository,
        input.githubIssue.number,
        label,
      )
    ))
    return statusLabels.length
      ? `Removed ${statusLabels.join(", ")} from closed issue #${input.githubIssue.number}.`
      : `Closed issue #${input.githubIssue.number} has no planning status labels.`
  }
  let selected = selectPipeline(labels, input.pipelineMap)
  let defaulted = false
  if (!selected) {
    await addGitHubIssueLabel(
      input.githubToken,
      input.repository,
      input.githubIssue.number,
      input.defaultLabel,
    )
    selected = selectPipeline([...labels, input.defaultLabel], input.pipelineMap)
    defaulted = true
  }
  if (!selected) throw new Error("Default status label is not in the pipeline map")

  const issueData = await zenhubGraphQL<IssueData>(
    input.zenhubToken,
    `query IssueForPipelineSync($repositoryGhId: Int!, $issueNumber: Int!, $workspaceId: ID!) {
      issueByInfo(repositoryGhId: $repositoryGhId, issueNumber: $issueNumber) {
        id
        pipelineIssue(workspaceId: $workspaceId) { pipeline { id name } }
      }
    }`,
    {
      issueNumber: input.githubIssue.number,
      repositoryGhId: input.repositoryGhId,
      workspaceId: input.workspaceId,
    },
  )
  if (!issueData.issueByInfo) {
    throw new Error(`Zenhub could not resolve issue #${input.githubIssue.number}`)
  }
  if (issueData.issueByInfo.pipelineIssue?.pipeline?.id === selected.pipelineId) {
    const prefix = defaulted ? `Defaulted to ${selected.label}; ` : ""
    return `${prefix}issue #${input.githubIssue.number} is already synchronized.`
  }

  const moved = await zenhubGraphQL<MoveData>(
    input.zenhubToken,
    `mutation MoveIssue($input: MoveIssueInput!, $workspaceId: ID!) {
      moveIssue(input: $input) {
        issue { pipelineIssue(workspaceId: $workspaceId) { pipeline { id name } } }
      }
    }`,
    {
      input: {
        issueId: issueData.issueByInfo.id,
        pipelineId: selected.pipelineId,
        position: 0,
      },
      workspaceId: input.workspaceId,
    },
  )
  const pipeline = moved.moveIssue.issue.pipelineIssue.pipeline
  if (pipeline.id !== selected.pipelineId) throw new Error("Zenhub returned the wrong pipeline")
  return `Moved issue #${input.githubIssue.number} to ${pipeline.name} for ${selected.label}.`
}
