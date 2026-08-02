import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import type { SamplingFailureReason } from "./sampling_phase_types.ts"
import type { ProviderParseDiagnostic } from "./provider_parse_diagnostic.ts"
import type { ProviderStderrCode } from "./provider_stderr_codes.ts"

export async function appendSamplingFailureReceipt(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
  reason: SamplingFailureReason | "provider_deadman_fallback_pending",
  rollbackInvoked: boolean,
  diagnostic?: ProviderParseDiagnostic,
  childExitCode?: number,
  providerCode?: ProviderStderrCode,
): Promise<boolean> {
  if (!state.receipt || state.receipt.poisoned) return false
  try {
    await dependencies.appendReceipt(state.receipt, {
      event_type: "failure",
      timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
      metrics: {
        status: "failed", error_class: reason,
        rollback_invoked: rollbackInvoked,
        ...(childExitCode === undefined ? {} : { child_exit_code: childExitCode }),
        ...(providerCode === undefined ? {} : { provider_code: providerCode }),
        ...(diagnostic ? {
          parse_subreason: diagnostic.subreason,
          observed_top_level_type: diagnostic.topLevelType,
          observed_row_count: diagnostic.rowCount,
          observed_outer_keys: diagnostic.outerKeys,
          observed_outer_unexpected_keys: diagnostic.outerUnexpectedKeyCount,
          observed_sample_keys: diagnostic.sampleKeys,
          observed_sample_unexpected_keys: diagnostic.sampleUnexpectedKeyCount,
          observed_value_types: diagnostic.sampleValueTypes,
        } : {}),
      },
    })
    return true
  } catch {
    return false
  }
}
