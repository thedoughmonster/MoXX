import type { BoundedChildRequest, BoundedChildResult, CanaryControlLock } from "./process_types.ts"
import type { RepositoryPreflight } from "./repository_preflight_types.ts"
import type { CliOptions } from "./types.ts"

export type BoundedChildRunner = (
  request: BoundedChildRequest,
) => Promise<BoundedChildResult>

export type RuntimeExecutables = {
  gitExecutable: string
  pnpmExecutable: string
  flockExecutable: string
}

export type ReleasedRuntime = {
  options: CliOptions
  repository: RepositoryPreflight
  executables: RuntimeExecutables
  lock: CanaryControlLock
}

export type RuntimePreparationDependencies = {
  environment: NodeJS.ProcessEnv
  nodeVersion: string
  runChild: BoundedChildRunner
  resolveExecutables: (environment: NodeJS.ProcessEnv) => Promise<RuntimeExecutables>
  collectEvidence: (
    root: string,
    executables: RuntimeExecutables,
    runner: BoundedChildRunner,
    nodeVersion: string,
    environment: NodeJS.ProcessEnv,
  ) => Promise<RepositoryPreflight>
  acquireLock: (environment: NodeJS.ProcessEnv) => Promise<CanaryControlLock>
}

export type InternalProviderSqlKind =
  | "cleanup"
  | "deadman_reconciliation"
  | "fast_sample"
  | "guard_bootstrap"
  | "guard_heartbeat_fast"
  | "guard_heartbeat_resource"
  | "resource_sample"
  | "rollback"

export type InternalProviderSql = Readonly<{
  kind: InternalProviderSqlKind
  sql: string
  sha256: string
}>

export type ProviderQueryFailureReason =
  | "adapter_failure"
  | "cancelled"
  | "exit_failure"
  | "output_limit"
  | "schema_failure"
  | "signalled"
  | "timed_out"

export type ProviderQueryResult<T> =
  | { status: "success"; value: T }
  | { status: "failure"; reason: ProviderQueryFailureReason }

export type ProviderQueryRequest<T> = {
  repositoryRoot: string
  pnpmExecutable: string
  sql: InternalProviderSql
  parser: (stdout: Uint8Array) => T
  signal?: AbortSignal
}

export type ProviderQueryDependencies = {
  runChild: BoundedChildRunner
  environment: NodeJS.ProcessEnv
  temporaryRoot: string
}
