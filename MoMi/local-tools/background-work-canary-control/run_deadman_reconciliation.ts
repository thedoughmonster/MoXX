import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import type { DeadmanReconciliationResult } from "./deadman_reconciliation_types.ts"
import { generateDeadmanReconciliationSql } from "./generate_deadman_reconciliation_sql.ts"
import { parseDeadmanReconciliationOutput } from "./parse_deadman_reconciliation_output.ts"
import type { ProviderQueryResult } from "./runtime_adapter_types.ts"

export async function runDeadmanReconciliation(
  handoff: DeadmanPhaseHandoff,
  dependencies: Pick<DeadmanPhaseDependencies, "query">,
): Promise<ProviderQueryResult<DeadmanReconciliationResult>> {
  const ambiguous = handoff.status === "bootstrap_ambiguous_deadman_fallback_pending"
  const generationSha256 = ambiguous
    ? handoff.attemptedGenerationSha256 : handoff.currentGenerationSha256
  const guardJobId = ambiguous ? null : handoff.guard.guardJobId
  try {
    return await dependencies.query({
      repositoryRoot: handoff.repositoryRoot,
      provider: handoff.runtime.provider,
      sql: createInternalProviderSql(
        "deadman_reconciliation", generateDeadmanReconciliationSql(),
      ),
      parser: (stdout) => parseDeadmanReconciliationOutput(stdout, {
        mode: ambiguous ? "ambiguous" : "known", runId: handoff.runId,
        generationSha256, guardJobId,
        startCronRunId: handoff.resourceBaseline.maxCronRunId,
        workBaseline: handoff.workBaseline,
      }),
    })
  } catch {
    return { status: "failure", reason: "adapter_failure" }
  }
}
