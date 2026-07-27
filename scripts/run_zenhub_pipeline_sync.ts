import { getGitHubIssue } from "./zenhub_pipeline_sync/github_issue.ts"
import { getGitHubIssues } from "./zenhub_pipeline_sync/github_issues.ts"
import { syncIssue } from "./zenhub_pipeline_sync/sync_issue.ts"

const required = [
  "GH_TOKEN",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_ID",
  "ZENHUB_API_TOKEN",
  "ZENHUB_DEFAULT_STATUS_LABEL",
  "ZENHUB_PIPELINE_MAP",
  "ZENHUB_WORKSPACE_ID",
] as const
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Missing environment: ${missing.join(", ")}`)

const repositoryGhId = Number(process.env.GITHUB_REPOSITORY_ID)
if (!Number.isSafeInteger(repositoryGhId) || repositoryGhId < 1) {
  throw new Error("GITHUB_REPOSITORY_ID must be a positive integer")
}
const requestedNumber = process.env.ZENHUB_ISSUE_NUMBER?.trim()
const issueNumber = requestedNumber ? Number(requestedNumber) : null
if (issueNumber !== null && (!Number.isSafeInteger(issueNumber) || issueNumber < 1)) {
  throw new Error("ZENHUB_ISSUE_NUMBER must be blank or a positive integer")
}

const pipelineMap = JSON.parse(process.env.ZENHUB_PIPELINE_MAP!) as Record<string, string>
if (
  !pipelineMap || Array.isArray(pipelineMap) ||
  Object.entries(pipelineMap).some(([label, id]) => !label || typeof id !== "string" || !id)
) {
  throw new Error("ZENHUB_PIPELINE_MAP must map non-empty labels to pipeline IDs")
}
if (!Object.hasOwn(pipelineMap, process.env.ZENHUB_DEFAULT_STATUS_LABEL!)) {
  throw new Error("ZENHUB_DEFAULT_STATUS_LABEL must exist in ZENHUB_PIPELINE_MAP")
}

const githubIssues = issueNumber === null
  ? await getGitHubIssues(process.env.GH_TOKEN!, process.env.GITHUB_REPOSITORY!)
  : [await getGitHubIssue(
    process.env.GH_TOKEN!,
    process.env.GITHUB_REPOSITORY!,
    issueNumber,
  )]

const failures: string[] = []
for (const githubIssue of githubIssues) {
  try {
    const result = await syncIssue({
      defaultLabel: process.env.ZENHUB_DEFAULT_STATUS_LABEL!,
      githubIssue,
      githubToken: process.env.GH_TOKEN!,
      pipelineMap,
      repository: process.env.GITHUB_REPOSITORY!,
      repositoryGhId,
      workspaceId: process.env.ZENHUB_WORKSPACE_ID!,
      zenhubToken: process.env.ZENHUB_API_TOKEN!,
    })
    process.stdout.write(`${result}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`#${githubIssue.number}: ${message}`)
    process.stderr.write(`Failed issue #${githubIssue.number}: ${message}\n`)
  }
}
if (failures.length) throw new Error(`Zenhub reconciliation failures: ${failures.join("; ")}`)
