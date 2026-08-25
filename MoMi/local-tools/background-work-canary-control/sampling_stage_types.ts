import type { CombinedHeartbeatParseResult } from "./combined_heartbeat_types.ts"
import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import type { ResourceBaseline } from "./query_payload_types.ts"
import type { FastSample } from "./sample_types.ts"
import type { ProviderParseDiagnostic } from "./provider_parse_diagnostic.ts"
import type { ProviderStderrCode } from "./provider_stderr_codes.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"

export type PreGuardBaselines = {
  work: WorkBaseline
  resource: ResourceBaseline
  fastSample: FastSample
  resourceObservedAtUtcMs: number
}

export type GuardBootstrapStageResult = {
  guard: GuardBootstrapResult
  generationSha256: string
}

export type SamplingBoundarySuccess = {
  status: "completed"
  currentGenerationSha256: string
  samplesCompleted: 21
  resourceSamplesCompleted: 6
  lastObservedAtUtcMs: number
}

export type SamplingBoundaryFailure = {
  status: "failed"
  stage: import("./sampling_phase_types.ts").SamplingFailureStage
  reason: import("./sampling_phase_types.ts").SamplingFailureReason
  schemaDiagnostic?: ProviderParseDiagnostic
  childExitCode?: number
  providerCode?: ProviderStderrCode
  stopReasons: readonly import("./sample_types.ts").ThresholdStopReason[]
  currentGenerationSha256: string
  samplesCompleted: number
  resourceSamplesCompleted: number
  lastObservedAtUtcMs: number | null
}

export type SamplingBoundaryRunResult = SamplingBoundarySuccess | SamplingBoundaryFailure

export type SamplingBoundaryRecord = {
  parsed: CombinedHeartbeatParseResult
  nextGenerationSha256: string
}
