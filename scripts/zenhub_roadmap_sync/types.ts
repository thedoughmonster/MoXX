export type RoadmapEntry = {
  issue_number: number
  order: string
  title: string
}

export type RoadmapContract = {
  schema_version: 1
  initiative: RoadmapEntry
  projects: RoadmapEntry[]
}

export type GitHubRoadmapIssue = {
  number: number
  title: string
  pull_request?: unknown
}

export type ZenhubIssueType = {
  id: string
  name: string
}

export type ZenhubRoadmapIssue = {
  id: string
  issueType: null | ZenhubIssueType
  number: number
  parentIssue: null | { id: string; number: number }
}

export type RoadmapSyncInput = {
  contract: RoadmapContract
  githubRepository: string
  githubRepositoryId: number
  githubToken: string
  workspaceId: string
  zenhubToken: string
}
