import type { EnvironmentKey } from "../deploy/types.ts"
import type { BoundPlan, ValidationReceipt } from "../dev_loop/types.ts"

export type CommandOptions = {
  capture?: boolean
  allowFailure?: boolean
}

export type CommandResult = {
  status: number
  stdout: string
  stderr: string
}

export type WorkflowRun = {
  databaseId: number
  headSha: string
  status: string
  conclusion: string | null
  displayTitle?: string
}

export type WorkflowJob = {
  id: number
  name: string
  status: string
  conclusion: string | null
}

export type ReleaseReceipt = {
  schema_version: 1
  kind: "release"
  environment: EnvironmentKey
  base_sha: string
  head_sha: string
  head_tree: string
  diff_sha256: string
  impact_sha256: string
  plan_sha256: string
  validation_receipt_sha256: string
  validation: ValidationReceipt
  plan: BoundPlan
  database: "none" | "preview_apply_parity_complete"
  services: string[]
  functions: string[]
  deployment_run_id?: number
}
