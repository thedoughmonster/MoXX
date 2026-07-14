import type { EnvironmentKey } from "../deploy/types.ts"

export type CommandOptions = {
  capture?: boolean
  allowFailure?: boolean
}

export type CommandResult = {
  status: number
  stdout: string
  stderr: string
}

export type ReleasePreflight = {
  environment: EnvironmentKey
  branch: string
  headSha: string
}

export type PullRequestRecord = {
  number: number
  headRefOid: string
  isDraft: boolean
}

export type WorkflowRun = {
  databaseId: number
  headSha: string
  status: string
  conclusion: string | null
}
