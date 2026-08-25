import type { GuardHeartbeatInput, GuardHeartbeatResult } from "./guard_heartbeat_types.ts"
import type { ResourceBaseline } from "./query_payload_types.ts"
import type { FastSample, ResourceSample, ThresholdStopReason } from "./sample_types.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"

export type CombinedHeartbeatInput = GuardHeartbeatInput & {
  includeResource: boolean
}

export type CombinedHeartbeatParseContext = {
  runId: string
  guardJobId: number
  previousGenerationSha256: string
  nextGenerationSha256: string
  includeResource: boolean
  startCronRunId: number
  missedSamples: number
  overlappingSamples: number
  workBaseline: WorkBaseline
  resourceBaseline: ResourceBaseline | null
}

export type CombinedHeartbeatParseResult = {
  status: "heartbeat_committed_passed" | "heartbeat_committed_stop_required"
  heartbeat: GuardHeartbeatResult & { observedAtUtcMs: number }
  fast: FastSample
  resourceIncluded: boolean
  resource: ResourceSample | null
  stopReasons: readonly ThresholdStopReason[]
}

export type CombinedHeartbeatModelInput = {
  sqlCommitted: boolean
  parseSucceeded: boolean
  coverageValid: boolean
  resourceExpected: boolean
  resourceMatched: boolean
  thresholdStopCount: number
}

export type CombinedHeartbeatModelOutcome =
  | "heartbeat_committed_coverage_rollover"
  | "heartbeat_committed_fast_passed"
  | "heartbeat_committed_parse_failure"
  | "heartbeat_committed_resource_mismatch"
  | "heartbeat_committed_resource_passed"
  | "heartbeat_committed_stop_required"
  | "sql_rollback"

export type CombinedHeartbeatModelResult = {
  outcome: CombinedHeartbeatModelOutcome
  actions: readonly string[]
}
