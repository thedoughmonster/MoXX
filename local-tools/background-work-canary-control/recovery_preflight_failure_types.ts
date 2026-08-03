import type { ProviderParseSubreason,
  ProviderObservedValueType } from "./provider_parse_diagnostic.ts"
import type { ProviderStderrCode } from "./provider_stderr_codes.ts"

export const RECOVERY_PREFLIGHT_REASON_CATEGORIES = [
  "adapter", "exit", "provider_category", "output_limit", "timeout",
  "parse_schema", "cancelled", "signalled", "work", "control", "cohort",
  "routes", "safety",
] as const

export type RecoveryPreflightReasonCategory =
  typeof RECOVERY_PREFLIGHT_REASON_CATEGORIES[number]
export type RecoveryPreflightStage =
  "provider_query" | "parse_schema" | "invariant_validation"
export type RecoveryPreflightInvariantGroups = {
  work: boolean; control: boolean; cohort: boolean; routes: boolean; safety: boolean
}
export type RecoveryPreflightParseEvidence = {
  subreason: ProviderParseSubreason
  topLevelType: ProviderObservedValueType
  rowCount: number
  outerUnexpectedKeyCount: number
  sampleUnexpectedKeyCount: number
}
export type RecoveryPreflightFailure = {
  stage: RecoveryPreflightStage
  reasonCategory: RecoveryPreflightReasonCategory
  durationMs: number
  querySha256: string
  failureFingerprint: string
  childExitCode?: number
  providerCategory?: ProviderStderrCode
  parseEvidence?: RecoveryPreflightParseEvidence
  invariantGroups?: RecoveryPreflightInvariantGroups
}
