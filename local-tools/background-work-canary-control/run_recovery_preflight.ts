import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { createRecoveryPreflightFailure } from "./create_recovery_preflight_failure.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryPreflightSql } from "./generate_recovery_preflight_sql.ts"
import { parseRecoveryPreflightOutput } from "./parse_recovery_preflight_output.ts"
import { RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import { RecoveryPreflightFailureError } from "./recovery_preflight_failure_error.ts"
import type { RecoveryPreflightReasonCategory } from "./recovery_preflight_failure_types.ts"
import { RecoveryPreflightInvariantError } from "./recovery_preflight_invariant_error.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"
import { validateRecoveryPreflight } from "./validate_recovery_preflight.ts"

export async function runRecoveryPreflight(state: RecoveryState): Promise<RecoverySnapshot> {
  const startedAt = Date.now()
  const sql = createInternalProviderSql("recovery_preflight", generateRecoveryPreflightSql())
  state.preflightQuerySha256 = sql.sha256
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider, signal: state.signal, sql,
    outputLimitBytes: RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES,
    parser: parseRecoveryPreflightOutput }, { temporaryRoot: "/tmp" })
  const endedAt = Date.now()
  const durationMs = Math.max(0, endedAt - startedAt)
  state.preflightTiming = { startedAtUtcMs: startedAt, endedAtUtcMs: endedAt, durationMs }
  if (result.status === "failure") {
    const categories: Record<typeof result.reason, RecoveryPreflightReasonCategory> = {
      adapter_failure: "adapter", cancelled: "cancelled", exit_failure: "exit",
      output_limit: "output_limit", schema_failure: "parse_schema",
      signalled: "signalled", timed_out: "timeout",
    }
    const reasonCategory = result.providerCode ? "provider_category" :
      categories[result.reason]
    const diagnostic = result.schemaDiagnostic
    throw new RecoveryPreflightFailureError(createRecoveryPreflightFailure({
      stage: result.reason === "schema_failure" ? "parse_schema" : "provider_query",
      reasonCategory, durationMs, querySha256: sql.sha256,
      ...(result.childExitCode === undefined ? {} : { childExitCode: result.childExitCode }),
      ...(result.providerCode === undefined ? {} : { providerCategory: result.providerCode }),
      ...(diagnostic === undefined ? {} : { parseEvidence: {
        subreason: diagnostic.subreason, topLevelType: diagnostic.topLevelType,
        rowCount: diagnostic.rowCount,
        outerUnexpectedKeyCount: diagnostic.outerUnexpectedKeyCount,
        sampleUnexpectedKeyCount: diagnostic.sampleUnexpectedKeyCount,
      } }),
    }))
  }
  try { return validateRecoveryPreflight(result.value) } catch (error) {
    if (!(error instanceof RecoveryPreflightInvariantError)) throw error
    throw new RecoveryPreflightFailureError(createRecoveryPreflightFailure({
      stage: "invariant_validation", reasonCategory: error.reasonCategory,
      durationMs, querySha256: sql.sha256, invariantGroups: error.groups,
    }))
  }
}
