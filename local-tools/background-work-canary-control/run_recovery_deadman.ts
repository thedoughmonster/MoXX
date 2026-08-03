import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateDeadmanReconciliationSql } from "./generate_deadman_reconciliation_sql.ts"
import { parseRecoveryDeadmanOutput } from "./parse_recovery_deadman_output.ts"
import type { RecoveryState } from "./recovery_types.ts"
import { waitForRecoveryBoundary } from "./wait_for_recovery_boundary.ts"

type RecoveryDeadmanDependencies = {
  wait: typeof waitForRecoveryBoundary
  query: typeof executeProviderQuery
}

const DEFAULT_DEPENDENCIES: RecoveryDeadmanDependencies = {
  wait: waitForRecoveryBoundary,
  query: executeProviderQuery,
}

export async function runRecoveryDeadman(
  state: RecoveryState, dependencies = DEFAULT_DEPENDENCIES,
): Promise<boolean> {
  const baseline = state.activation?.frozen ?? state.preflight
  if (!state.guard || !baseline || state.runtime.provider.status() === "lost") return false
  const waited = await dependencies.wait(Date.now() + 36_000,
    new AbortController().signal)
  if (!waited || state.runtime.provider.status() === "lost") return false
  const context = { mode: "known", runId: state.runId,
    guardJobId: state.guard.guardJobId,
    startCronRunId: baseline.maxCronRunId,
    workBaseline: { toastReady: 0, routingReady: 0, deliveryReady: 0, queueReady: 0 } }
  const result = await dependencies.query({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    sql: createInternalProviderSql("deadman_reconciliation",
      generateDeadmanReconciliationSql()),
    parser: (output) => parseRecoveryDeadmanOutput(output, state, context) },
  { temporaryRoot: "/tmp" })
  if (result.status !== "success" || result.value.status !== "deadman_reconciled") return false
  state.deadmanReconciled = true
  state.generationSha256 = result.value.terminalEvidence!.generationSha256
  state.attemptedGenerationSha256 = undefined
  return true
}
